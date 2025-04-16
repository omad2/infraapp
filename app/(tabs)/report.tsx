// File: ReportScreen.tsx
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Image,
  Alert,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Keyboard,
  ActivityIndicator,
  Modal,
  RefreshControl,
  Dimensions,
  Platform,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import Toast from "react-native-toast-message";
import * as ImagePicker from "expo-image-picker";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { storage, db } from "../../config/firebase";
import { useAuth } from "../../contexts/AuthContext";
import {
  collection,
  addDoc,
  serverTimestamp,
  deleteDoc,
  doc,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system';
import env from '../../config/env';
import { irishCounties, isValidCounty } from '../../utils/irishCounties';
import ModernButton from "../../components/ModernButton";

const { width } = Dimensions.get('window');

const categories = [
  "Pothole",
  "Broken Streetlight",
  "Damaged Sidewalk",
  "Trash Overflow",
  "Flooded Area",
  "Power Outage",
  "Water Leak",
  "Graffiti/Vandalism",
  "Traffic Sign Issue",
  "Public Restroom Problem",
];

const ReportScreen = () => {
  const { user } = useAuth();
  const [imageUri, setImageUri] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [uniqueId, setUniqueId] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [description, setDescription] = useState("");
  const [reportDocId, setReportDocId] = useState<string | null>(null);
  const [status, setStatus] = useState<"pending" | "approved" | null>(null);
  const [hasExistingReport, setHasExistingReport] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [county, setCounty] = useState("");
  const [eircode, setEircode] = useState("");
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [countyModalVisible, setCountyModalVisible] = useState(false);
  const [isLocationLoading, setIsLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [showInstructions, setShowInstructions] = useState(true);

  const checkExistingReport = useCallback(async () => {
    if (!user) return;

    const q = query(
      collection(db, "reports"),
      where("userId", "==", user.uid),
      where("status", "==", "pending")
    );
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const docData = snapshot.docs[0].data();
      const docId = snapshot.docs[0].id;
      setHasExistingReport(true);
      setReportDocId(docId);
      setImageUrl(docData.imageUrl);
      setSelectedCategory(docData.category);
      setDescription(docData.description);
      setUniqueId(docData.id);
      setStatus(docData.status || "pending");
    } else {
      setHasExistingReport(false);
      setImageUrl("");
      setImageUri("");
      setUniqueId("");
      setDescription("");
      setSelectedCategory("");
      setReportDocId(null);
      setStatus(null);
    }
  }, [user]);

  useEffect(() => {
    checkExistingReport();
  }, [checkExistingReport]);

  useEffect(() => {
    // Hide instructions after 10 seconds
    const timer = setTimeout(() => {
      setShowInstructions(false);
    }, 10000);

    return () => clearTimeout(timer);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await checkExistingReport();
    setRefreshing(false);
  }, [checkExistingReport]);

  const generateId = () => {
    const timestamp = Date.now().toString(36);
    const random = Math.floor(Math.random() * 1000000).toString(36);
    return `${timestamp}-${random}`;
  };

  const showToast = (type: 'success' | 'error' | 'info', text1: string, text2?: string) => {
    Toast.show({
      type,
      text1,
      text2,
      position: 'bottom',
      visibilityTime: 4000,
      autoHide: true,
      topOffset: 30,
    });
  };

  const pickImage = async (fromCamera: boolean) => {
    try {
      const result = await (fromCamera
        ? ImagePicker.launchCameraAsync()
        : ImagePicker.launchImageLibraryAsync());

      if (!result.canceled) {
        const selectedUri = result.assets[0].uri;
        const id = generateId();
        setImageUri(selectedUri);
        setUniqueId(id);
        setSelectedCategory("");
        setDescription("");
        setReportDocId(null);
        setImageUrl("");
        setStatus(null);
        showToast('success', 'Image selected successfully');
      }
    } catch (err: any) {
      showToast('error', 'Failed to pick image', err.message);
    }
  };

  const getLocation = async () => {
    setIsLocationLoading(true);
    setLocationError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Permission to access location was denied');
        showToast('error', 'Permission Denied', 'Location access is required for accurate reporting');
        setIsLocationLoading(false);
        return;
      }

      // Get location with high accuracy
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      
      // Store location accuracy for validation
      setLocationAccuracy(loc.coords.accuracy);
      setLocation(loc);

      // Get detailed address information
      const addresses = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });

      if (addresses && addresses.length > 0) {
        const address = addresses[0];
        
        // Build a more complete address
        const streetNumber = address.streetNumber || '';
        const street = address.street || '';
        const fullStreet = streetNumber ? `${streetNumber} ${street}` : street;
        
        setAddressLine1(fullStreet);
        
        // Try to get a more specific address line 2
        const district = address.district || '';
        const subregion = address.subregion || '';
        const addressLine2Value = district || subregion || '';
        setAddressLine2(addressLine2Value);
        
        // Set county with validation
        const region = address.region || '';
        if (isValidCounty(region)) {
          setCounty(region);
        } else {
          // Try to find a valid county from the address components
          const possibleCounty = addresses.find(addr => 
            addr.region && isValidCounty(addr.region)
          )?.region;
          
          if (possibleCounty) {
            setCounty(possibleCounty);
          }
        }
        
        // Set Eircode (postal code in Ireland)
        setEircode(address.postalCode || '');
        showToast('success', 'Location retrieved successfully');
      } else {
        setLocationError('Could not determine address from location');
        showToast('error', 'Location Error', 'Could not determine address from location');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred";
      setLocationError(errorMessage);
      showToast('error', 'Failed to get location', errorMessage);
    } finally {
      setIsLocationLoading(false);
    }
  };

  // Validate if the location is real and accurate enough
  const isLocationValid = () => {
    if (!location) return false;
    
    // Check if accuracy is good enough (less than 100 meters)
    if (locationAccuracy && locationAccuracy > 100) {
      return false;
    }
    
    // Check if we have at least some address components
    return !!(addressLine1 || county || eircode);
  };

  useEffect(() => {
    getLocation();
  }, []);

  const verifyImageWithChatGPT = async (imageUri: string, category: string) => {
    try {
      // Convert image to base64 with compression
      const base64Image = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Add delay between requests to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));

      const response = await fetch(`${env.apiUrl}/api/verify-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageBase64: base64Image,
          category,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to verify image');
      }

      const data = await response.json();
      return data.isVerified;
    } catch (error: any) {
      console.error("Error verifying image:", error);
      if (error.status === 429) {
        // If rate limited, wait longer and retry once
        await new Promise(resolve => setTimeout(resolve, 5000));
        return verifyImageWithChatGPT(imageUri, category);
      }
      throw new Error(error.message || "Failed to verify image with AI");
    }
  };

  const checkDuplicateReport = async (currentLocation: Location.LocationObject) => {
    if (!user) return false;

    const RADIUS_METERS = 50; // 50 meters radius for duplicate check

    const q = query(
      collection(db, "reports"),
      where("userId", "==", user.uid),
      where("status", "==", "pending")
    );
    const snapshot = await getDocs(q);

    for (const doc of snapshot.docs) {
      const reportData = doc.data();
      if (reportData.location) {
        const distance = calculateDistance(
          currentLocation.coords.latitude,
          currentLocation.coords.longitude,
          reportData.location.coords.latitude,
          reportData.location.coords.longitude
        );
        if (distance <= RADIUS_METERS) {
          return true;
        }
      }
    }
    return false;
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
  };

  const uploadReport = async () => {
    if (!imageUri || !selectedCategory || !description || !addressLine1 || !county || !eircode) {
      showToast('error', 'Missing Fields', 'Please fill in all fields before submitting.');
      return;
    }

    if (!isValidCounty(county)) {
      showToast('error', 'Invalid County', 'Please select a valid Irish county.');
      return;
    }

    if (!isLocationValid()) {
      showToast('error', 'Location Validation Failed', 'The location data appears to be inaccurate or incomplete. Please try refreshing your location or enter the address manually.');
      return;
    }

    if (location) {
      const isDuplicate = await checkDuplicateReport(location);
      if (isDuplicate) {
        showToast('error', 'Duplicate Report', 'You have already submitted a report for this location. Please wait for the previous report to be approved before submitting another one in this area.');
        return;
      }
    }

    setIsLoading(true);
    try {
      // First verify the image with ChatGPT
      const isVerified = await verifyImageWithChatGPT(imageUri, selectedCategory);
      
      if (!isVerified) {
        showToast('error', 'Validation Failed', 'Validation check failed. Please try again.');
        // Reset only image and category related fields
        setImageUri("");
        setSelectedCategory("");
        setDescription("");
        setUniqueId(generateId()); // Generate new ID for next attempt
        setIsLoading(false);
        return;
      }

      // Add delay before next operation
      await new Promise(resolve => setTimeout(resolve, 1000));

      const imageRef = ref(storage, `reports/${uniqueId}.jpg`);
      const blob = await (await fetch(imageUri)).blob();
      await uploadBytes(imageRef, blob);
      const downloadURL = await getDownloadURL(imageRef);

      const docRef = await addDoc(collection(db, "reports"), {
        id: uniqueId,
        imageUrl: downloadURL,
        category: selectedCategory,
        description,
        addressLine1,
        addressLine2,
        county,
        eircode,
        location,
        timestamp: serverTimestamp(),
        userId: user?.uid,
        status: "pending",
        assigned: null,
      });

      setImageUrl(downloadURL);
      setReportDocId(docRef.id);
      setStatus("pending");
      setHasExistingReport(true);
      showToast('success', 'Report Submitted', 'Your report has been submitted successfully!');
    } catch (err) {
      showToast('error', 'Upload Failed', err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const deleteReport = async () => {
    try {
      if (!reportDocId) return;

      await deleteDoc(doc(db, "reports", reportDocId));
      await deleteObject(ref(storage, `reports/${uniqueId}.jpg`));

      setImageUrl("");
      setImageUri("");
      setUniqueId("");
      setDescription("");
      setSelectedCategory("");
      setReportDocId(null);
      setStatus(null);
      setHasExistingReport(false);
      showToast('success', 'Report Deleted', 'Your report has been deleted successfully');
    } catch (err: any) {
      showToast('error', 'Delete Failed', err.message);
    }
  };

  // Render county selection modal
  const renderCountyModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={countyModalVisible}
      onRequestClose={() => setCountyModalVisible(false)}
    >
      <View style={styles.modalOverlayContainer}>
        <BlurView intensity={50} style={styles.modalOverlay}>
          <View style={styles.modalOverlayBackground} />
        </BlurView>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select County</Text>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setCountyModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
          
          <FlatList
            data={irishCounties}
            keyExtractor={(item) => item}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.countyButton,
                  county === item && styles.selectedCounty,
                ]}
                onPress={() => {
                  setCounty(item);
                  setCountyModalVisible(false);
                  showToast('success', 'County Selected', `${item} has been selected`);
                }}
              >
                <Text
                  style={[
                    styles.countyText,
                    county === item && styles.selectedCountyText,
                  ]}
                >
                  {item}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>You must be logged in to report.</Text>
      </View>
    );
  }

  return (
    <LinearGradient
      colors={['#000000', '#1a1a1a', '#000000']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <LinearGradient
        colors={['rgba(255,255,255,0.1)', 'transparent']}
        style={styles.backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.headerContainer}>
          <Text style={styles.title}>Report an Issue</Text>
          <Text style={styles.subtitle}>Help improve your community by reporting infrastructure issues</Text>
        </View>

        {showInstructions && (
          <View style={styles.popupOverlay}>
            <BlurView intensity={50} tint="dark" style={styles.popupBlur}>
              <View style={styles.welcomeContainer}>
                <Text style={styles.welcomeTitle}>How to Report an Issue</Text>
                <Text style={styles.welcomeText}>1. Take a photo or select from gallery</Text>
                <Text style={styles.welcomeText}>2. Select category</Text>
                <Text style={styles.welcomeText}>3. Add description</Text>
                <Text style={styles.welcomeText}>4. Enter location</Text>
                <Text style={styles.welcomeText}>5. Submit for verification</Text>
                <TouchableOpacity 
                  style={styles.dismissButton}
                  onPress={() => setShowInstructions(false)}
                >
                  <Text style={styles.dismissButtonText}>Got it</Text>
                </TouchableOpacity>
              </View>
            </BlurView>
          </View>
        )}

        {isLoading && (
          <View style={styles.loadingContainer}>
            <BlurView intensity={80} style={styles.loadingBlur}>
              <ActivityIndicator size="large" color="#2AADAD" />
              <Text style={styles.loadingText}>Verifying image and uploading report...</Text>
            </BlurView>
          </View>
        )}

        {hasExistingReport && !imageUrl && (
          <BlurView intensity={20} tint="dark" style={styles.warningContainer}>
            <Text style={styles.warningText}>
              You cannot upload a new report until the previous one is deleted or
              approved.
            </Text>
          </BlurView>
        )}

        <View style={styles.contentContainer}>
          <View style={styles.buttonRow}>
            <ModernButton
              title="Take Photo"
              variant="primary"
              size="medium"
              onPress={() => pickImage(true)}
              disabled={hasExistingReport}
              fullWidth={false}
            />

            <ModernButton
              title="Choose from Gallery"
              variant="primary"
              size="medium"
              onPress={() => pickImage(false)}
              disabled={hasExistingReport}
              fullWidth={false}
            />
          </View>

          {imageUri && !imageUrl && (
            <ScrollView 
              style={styles.formScrollView}
              contentContainerStyle={styles.formScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.formContainer}>
                <Text style={styles.label}>Select a category:</Text>
                <FlatList
                  horizontal
                  data={categories}
                  keyExtractor={(item) => item}
                  contentContainerStyle={styles.categoryList}
                  showsHorizontalScrollIndicator={false}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[
                        styles.categoryButton,
                        selectedCategory === item && styles.selectedCategory,
                      ]}
                      onPress={() => setSelectedCategory(item)}
                    >
                      <Text
                        style={[
                          styles.categoryText,
                          selectedCategory === item && styles.selectedCategoryText,
                        ]}
                      >
                        {item}
                      </Text>
                    </TouchableOpacity>
                  )}
                />

                {selectedCategory !== "" && (
                  <>
                    <TextInput
                      style={styles.input}
                      placeholder="Add a description (max 150 characters)"
                      placeholderTextColor="rgba(235, 235, 245, 0.4)"
                      value={description}
                      onChangeText={(text) => setDescription(text.slice(0, 150))}
                      multiline
                      blurOnSubmit={true}
                      onSubmitEditing={() => Keyboard.dismiss()}
                    />

                    <TextInput
                      style={styles.input}
                      placeholder="Address Line 1"
                      placeholderTextColor="rgba(235, 235, 245, 0.4)"
                      value={addressLine1}
                      onChangeText={setAddressLine1}
                    />

                    <TextInput
                      style={styles.input}
                      placeholder="Address Line 2 (Optional)"
                      placeholderTextColor="rgba(235, 235, 245, 0.4)"
                      value={addressLine2}
                      onChangeText={setAddressLine2}
                    />

                    <TouchableOpacity
                      style={styles.input}
                      onPress={() => setCountyModalVisible(true)}
                    >
                      <Text style={county ? styles.selectedText : styles.placeholderText}>
                        {county || "Select County"}
                      </Text>
                    </TouchableOpacity>
                    
                    {locationError && (
                      <BlurView intensity={20} tint="dark" style={styles.errorContainer}>
                        <Text style={styles.errorText}>{locationError}</Text>
                      </BlurView>
                    )}
                    
                    {locationAccuracy && locationAccuracy > 100 && (
                      <BlurView intensity={20} tint="dark" style={styles.warningContainer}>
                        <Text style={styles.warningText}>
                          Location accuracy is low. Please enter address manually.
                        </Text>
                      </BlurView>
                    )}

                    <TextInput
                      style={styles.input}
                      placeholder="Eircode"
                      placeholderTextColor="rgba(235, 235, 245, 0.4)"
                      value={eircode}
                      onChangeText={setEircode}
                    />

                    <ModernButton
                      title="Submit Report"
                      variant="primary"
                      size="large"
                      onPress={uploadReport}
                      fullWidth={true}
                    />
                  </>
                )}
              </View>
            </ScrollView>
          )}

          {imageUrl && (
            <ScrollView 
              style={styles.formScrollView}
              contentContainerStyle={styles.formScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <BlurView intensity={20} tint="dark" style={styles.card}>
                <Text style={styles.cardTitle}>Report #{uniqueId}</Text>
                <Image source={{ uri: imageUrl }} style={styles.image} />
                <Text style={styles.cardLabel}>Category:</Text>
                <Text style={styles.cardContent}>{selectedCategory}</Text>
                <Text style={styles.cardLabel}>Description:</Text>
                <Text style={styles.cardContent}>{description}</Text>
                <Text style={styles.cardLabel}>Address:</Text>
                <Text style={styles.cardContent}>{addressLine1}</Text>
                {addressLine2 ? <Text style={styles.cardContent}>{addressLine2}</Text> : null}
                <Text style={styles.cardContent}>{county}</Text>
                <Text style={styles.cardContent}>{eircode}</Text>
                <Text style={styles.cardLabel}>Status:</Text>
                <Text
                  style={[
                    styles.cardContent,
                    { color: status === "approved" ? "#22c55e" : "#facc15" },
                  ]}
                >
                  {status?.toUpperCase()}
                </Text>
                {status === 'pending' && (
                  <ModernButton
                    title="Delete Report"
                    variant="secondary"
                    size="medium"
                    onPress={deleteReport}
                    fullWidth={true}
                  />
                )}
              </BlurView>
            </ScrollView>
          )}

          {renderCountyModal()}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#0e0e0e',
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '100%',
    opacity: 0.5,
  },
  safeArea: {
    flex: 1,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 1,
  },
  subtitle: {
    color: 'rgba(235, 235, 245, 0.6)',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: '80%',
  },
  text: { 
    color: "#fff",
    fontSize: 16,
    textAlign: 'center',
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  buttonRow: {
    flexDirection: "row",
    marginBottom: 16,
    justifyContent: "center",
    gap: 16,
  },
  formScrollView: {
    flex: 1,
  },
  formScrollContent: {
    paddingBottom: 16,
  },
  formContainer: {
    marginBottom: 24,
  },
  label: {
    color: "#FFFFFF",
    marginBottom: 12,
    fontWeight: "500",
    fontSize: 16,
  },
  categoryList: {
    gap: 10,
    paddingBottom: 8,
  },
  categoryButton: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(235, 235, 245, 0.1)",
  },
  categoryText: {
    color: "#FFFFFF",
    fontWeight: "500",
  },
  selectedCategory: {
    backgroundColor: "#2AADAD",
    borderColor: "#2AADAD",
  },
  selectedCategoryText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  input: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    color: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(235, 235, 245, 0.1)",
    marginVertical: 12,
    minHeight: 60,
  },
  card: {
    backgroundColor: "rgba(26, 26, 26, 0.7)",
    padding: 20,
    borderRadius: 16,
    marginTop: 16,
    alignItems: "center",
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: "rgba(235, 235, 245, 0.1)",
  },
  cardTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
  },
  cardLabel: {
    color: "rgba(235, 235, 245, 0.6)",
    marginTop: 12,
    fontWeight: "500",
    fontSize: 14,
  },
  cardContent: {
    color: "#FFFFFF",
    textAlign: "center",
    fontSize: 14,
    marginBottom: 4,
  },
  image: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    marginVertical: 12,
    resizeMode: "cover",
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingBlur: {
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    overflow: 'hidden',
  },
  loadingText: {
    color: '#FFFFFF',
    marginTop: 10,
    fontSize: 16,
  },
  modalOverlayContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalOverlayBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '80%',
    maxHeight: '80%',
    backgroundColor: 'rgba(26, 26, 26, 0.9)',
    borderRadius: 16,
    padding: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: "rgba(235, 235, 245, 0.1)",
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  modalCloseButton: {
    padding: 5,
  },
  modalCloseText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  countyButton: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(235, 235, 245, 0.1)',
  },
  selectedCounty: {
    backgroundColor: 'rgba(42, 173, 173, 0.2)',
  },
  countyText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  selectedCountyText: {
    fontWeight: 'bold',
    color: '#2AADAD',
  },
  selectedText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  placeholderText: {
    color: 'rgba(235, 235, 245, 0.4)',
    fontSize: 16,
  },
  errorContainer: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    overflow: 'hidden',
  },
  errorText: {
    color: '#f87171',
    marginBottom: 8,
  },
  warningContainer: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    overflow: 'hidden',
  },
  warningText: {
    color: '#facc15',
    marginBottom: 8,
  },
  popupOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  popupBlur: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  welcomeContainer: {
    backgroundColor: 'rgba(26, 26, 26, 0.95)',
    padding: 24,
    borderRadius: 16,
    width: '90%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: 'rgba(235, 235, 245, 0.1)',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  welcomeTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  welcomeText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 12,
    textAlign: 'center',
    lineHeight: 24,
  },
  dismissButton: {
    backgroundColor: '#2AADAD',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 16,
  },
  dismissButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ReportScreen;
