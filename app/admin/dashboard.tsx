import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, Linking, RefreshControl, Animated, Dimensions } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { router } from 'expo-router';
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../../config/firebase';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc, addDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { Image as ExpoImage, ImageStyle } from 'expo-image';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

type PendingReport = {
  id: string;
  docId: string;
  imageUrl: string;
  category: string;
  description: string;
  timestamp: any;
  addressLine1?: string;
  county?: string;
  eircode?: string;
  location?: any;
};

type AssignedReport = {
  id: string;
  docId: string;
  imageUrl: string;
  category: string;
  description: string;
  timestamp: any;
  addressLine1?: string;
  county?: string;
  eircode?: string;
  location?: any;
  status: string;
};

const { width } = Dimensions.get('window');

const ReportCard = ({ report, onApprove, onDecline }: { 
  report: PendingReport; 
  onApprove: () => void; 
  onDecline: () => void;
}) => {
  return (
    <View style={styles.card}>
      <ExpoImage 
        source={{ uri: report.imageUrl }} 
        style={styles.cardImage}
        contentFit="cover"
      />
      <View style={styles.cardContent}>
        <Text style={styles.cardCategory}>{report.category}</Text>
        <Text style={styles.cardDescription}>{report.description}</Text>
        {report.addressLine1 && (
          <Text style={styles.cardAddress}>{report.addressLine1}</Text>
        )}
        {report.county && (
          <Text style={styles.cardCounty}>{report.county}</Text>
        )}
      </View>
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[styles.button, styles.approveButton]} 
          onPress={onApprove}
        >
          <Ionicons name="checkmark-circle" size={24} color="#fff" />
          <Text style={styles.buttonText}>Approve</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.button, styles.declineButton]} 
          onPress={onDecline}
        >
          <Ionicons name="close-circle" size={24} color="#fff" />
          <Text style={styles.buttonText}>Decline</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const AssignedReportCard = ({ report, onOpenMaps, onComplete }: { 
  report: AssignedReport; 
  onOpenMaps: () => void;
  onComplete: () => void;
}) => {
  return (
    <View style={styles.card}>
      <ExpoImage 
        source={{ uri: report.imageUrl }} 
        style={styles.cardImage}
        contentFit="cover"
      />
      <View style={styles.cardContent}>
        <Text style={styles.cardCategory}>{report.category}</Text>
        <Text style={styles.cardDescription}>{report.description}</Text>
        {report.addressLine1 && (
          <Text style={styles.cardAddress}>{report.addressLine1}</Text>
        )}
        {report.county && (
          <Text style={styles.cardCounty}>{report.county}</Text>
        )}
        {report.eircode && (
          <Text style={styles.cardEircode}>Eircode: {report.eircode}</Text>
        )}
      </View>
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[styles.button, styles.mapsButton]} 
          onPress={onOpenMaps}
        >
          <Ionicons name="map" size={24} color="#fff" />
          <Text style={styles.buttonText}>Open in Maps</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.button, styles.completeButton]} 
          onPress={onComplete}
        >
          <Ionicons name="checkmark-circle" size={24} color="#fff" />
          <Text style={styles.buttonText}>Complete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default function AdminDashboard() {
  const { isAdmin, user } = useAuth();
  const [pendingReports, setPendingReports] = useState<PendingReport[]>([]);
  const [assignedReports, setAssignedReports] = useState<AssignedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'pending' | 'assigned'>('pending');
  const [refreshing, setRefreshing] = useState(false);
  const [tabAnimation] = useState(new Animated.Value(0));

  const fetchPendingReports = async () => {
    try {
      const q = query(
        collection(db, "reports"),
        where("status", "==", "pending")
      );
      const snapshot = await getDocs(q);
      const reports = snapshot.docs.map((doc) => ({
        ...doc.data(),
        id: doc.data().id,
        docId: doc.id,
      })) as PendingReport[];
      setPendingReports(reports);
    } catch (error) {
      console.error("Error fetching pending reports:", error);
      Alert.alert("Error", "Failed to fetch pending reports");
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignedReports = async () => {
    if (!user) return;
    
    try {
      const q = query(
        collection(db, "reports"),
        where("assigned", "==", user.uid),
        where("status", "==", "approved")
      );
      const snapshot = await getDocs(q);
      const reports = snapshot.docs.map((doc) => ({
        ...doc.data(),
        id: doc.data().id,
        docId: doc.id,
      })) as AssignedReport[];
      setAssignedReports(reports);
    } catch (error) {
      console.error("Error fetching assigned reports:", error);
      Alert.alert("Error", "Failed to fetch assigned reports");
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (activeTab === 'pending') {
        await fetchPendingReports();
      } else {
        await fetchAssignedReports();
      }
    } catch (error) {
      console.error("Error refreshing reports:", error);
    } finally {
      setRefreshing(false);
    }
  }, [activeTab]);

  const openInGoogleMaps = async (report: AssignedReport) => {
    try {
      let locationString = '';
      
      // If we have coordinates, use them
      if (report.location && report.location.coords) {
        const { latitude, longitude } = report.location.coords;
        locationString = `${latitude},${longitude}`;
      } 
      // Otherwise try to use address
      else if (report.addressLine1 && report.county) {
        locationString = `${report.addressLine1}, ${report.county}, Ireland`;
      }
      // Or just use Eircode if available
      else if (report.eircode) {
        locationString = report.eircode;
      }
      
      if (!locationString) {
        Alert.alert("Error", "No location information available for this report");
        return;
      }
      
      const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationString)}`;
      
      // Check if the URL can be opened
      const supported = await Linking.canOpenURL(url);
      
      if (supported) {
        // Open the URL
        await Linking.openURL(url);
      } else {
        Alert.alert("Error", "Cannot open Google Maps");
      }
    } catch (error) {
      console.error("Error opening maps:", error);
      Alert.alert("Error", "Failed to open Google Maps");
    }
  };

  const handleApprove = async (reportId: string, docId: string) => {
    if (processingId === docId) return;
    setProcessingId(docId);
    try {
      const reportRef = doc(db, "reports", docId);
      const reportDoc = await getDocs(query(collection(db, "reports"), where("id", "==", reportId)));
      const reportData = reportDoc.docs[0].data();
      
      await updateDoc(reportRef, {
        status: "approved"
      });

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 2);
      
      await addDoc(collection(db, "messages"), {
        userId: reportData.userId,
        title: "Report Approved",
        content: `Your report about "${reportData.category}" has been approved.`,
        type: "approval",
        reportId: reportId,
        createdAt: serverTimestamp(),
        read: false,
        expiresAt: expiresAt
      });

      setPendingReports(prev => prev.filter(report => report.docId !== docId));
      setCurrentCardIndex(0); // Reset to first card after removal
      Alert.alert("Success", "Report approved successfully");
    } catch (error) {
      console.error("Error approving report:", error);
      Alert.alert("Error", "Failed to approve report");
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (reportId: string, docId: string) => {
    if (processingId === docId) return;
    setProcessingId(docId);
    try {
      const reportRef = doc(db, "reports", docId);
      const reportDoc = await getDocs(query(collection(db, "reports"), where("id", "==", reportId)));
      const reportData = reportDoc.docs[0].data();
      
      await deleteDoc(reportRef);

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 2);
      
      await addDoc(collection(db, "messages"), {
        userId: reportData.userId,
        title: "Report Declined",
        content: `Your report about "${reportData.category}" has been declined. Please review and submit again.`,
        type: "decline",
        reportId: reportId,
        createdAt: serverTimestamp(),
        read: false,
        expiresAt: expiresAt
      });

      setPendingReports(prev => prev.filter(report => report.docId !== docId));
      setCurrentCardIndex(0); // Reset to first card after removal
      Alert.alert("Success", "Report declined and deleted");
    } catch (error) {
      console.error("Error declining report:", error);
      Alert.alert("Error", "Failed to decline report");
    } finally {
      setProcessingId(null);
    }
  };

  const handleComplete = async (reportId: string, docId: string) => {
    if (processingId === docId) return;
    setProcessingId(docId);
    try {
      const reportRef = doc(db, "reports", docId);
      const reportDoc = await getDoc(reportRef);
      
      if (!reportDoc.exists()) {
        throw new Error("Report not found");
      }
      
      const reportData = reportDoc.data();
      
      await updateDoc(reportRef, {
        status: "completed"
      });

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 2);
      
      await addDoc(collection(db, "messages"), {
        userId: reportData.userId,
        title: "Report Completed",
        content: `Your report about "${reportData.category}" has been marked as completed.`,
        type: "general",
        reportId: reportId,
        createdAt: serverTimestamp(),
        read: false,
        expiresAt: expiresAt
      });

      setAssignedReports(prev => prev.filter(report => report.docId !== docId));
      Alert.alert("Success", "Report marked as completed");
    } catch (error) {
      console.error("Error completing report:", error);
      Alert.alert("Error", "Failed to complete report");
    } finally {
      setProcessingId(null);
    }
  };

  useEffect(() => {
    fetchPendingReports();
    fetchAssignedReports();
  }, []);

  useEffect(() => {
    Animated.timing(tabAnimation, {
      toValue: activeTab === 'pending' ? 0 : 1,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [activeTab]);

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.errorText}>Access Denied</Text>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <LinearGradient
        colors={['#0e0e0e', '#1a1a1a', '#0e0e0e']}
        style={styles.gradient}
      />
      <View style={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.title}>Admin Dashboard</Text>
            <Text style={styles.subtitle}>Welcome, {user?.email}</Text>
          </View>
        </View>
        
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'pending' && styles.activeTab]}
            onPress={() => setActiveTab('pending')}
          >
            <Text style={[styles.tabText, activeTab === 'pending' && styles.activeTabText]}>
              Pending Reports
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'assigned' && styles.activeTab]}
            onPress={() => setActiveTab('assigned')}
          >
            <Text style={[styles.tabText, activeTab === 'assigned' && styles.activeTabText]}>
              My Assigned Reports
            </Text>
          </TouchableOpacity>
          <Animated.View 
            style={[
              styles.tabIndicator,
              {
                transform: [
                  {
                    translateX: tabAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, width / 2 - 20],
                    }),
                  },
                ],
              },
            ]}
          />
        </View>
        
        {activeTab === 'pending' ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pending Reports</Text>
            {loading ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading pending reports...</Text>
              </View>
            ) : pendingReports.length > 0 ? (
              <>
                <View style={styles.counterContainer}>
                  <Text style={styles.counterText}>
                    {pendingReports.length} {pendingReports.length === 1 ? 'Report' : 'Reports'} Pending
                  </Text>
                </View>
                <ScrollView 
                  style={styles.scrollView}
                  contentContainerStyle={styles.scrollViewContent}
                  refreshControl={
                    <RefreshControl
                      refreshing={refreshing}
                      onRefresh={onRefresh}
                      colors={['#2AADAD']}
                      tintColor="#2AADAD"
                      progressViewOffset={10}
                    />
                  }
                >
                  {pendingReports.map((report, index) => (
                    <View 
                      key={report.docId}
                      style={[
                        styles.card,
                        index === currentCardIndex ? styles.activeCard : styles.inactiveCard,
                        index < currentCardIndex && styles.hiddenCard
                      ]}
                    >
                      <ExpoImage 
                        source={{ uri: report.imageUrl }} 
                        style={styles.cardImage}
                        contentFit="cover"
                      />
                      <View style={styles.cardContent}>
                        <Text style={styles.cardCategory}>{report.category}</Text>
                        <Text style={styles.cardDescription}>{report.description}</Text>
                        {report.addressLine1 && (
                          <Text style={styles.cardAddress}>{report.addressLine1}</Text>
                        )}
                        {report.county && (
                          <Text style={styles.cardCounty}>{report.county}</Text>
                        )}
                      </View>
                      <View style={styles.buttonContainer}>
                        <TouchableOpacity 
                          style={[styles.button, styles.approveButton]} 
                          onPress={() => handleApprove(report.id, report.docId)}
                        >
                          <Ionicons name="checkmark-circle" size={24} color="#fff" />
                          <Text style={styles.buttonText}>Approve</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={[styles.button, styles.declineButton]} 
                          onPress={() => handleDecline(report.id, report.docId)}
                        >
                          <Ionicons name="close-circle" size={24} color="#fff" />
                          <Text style={styles.buttonText}>Decline</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              </>
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="document-text-outline" size={64} color="#2AADAD" />
                <Text style={styles.emptyText}>No pending reports</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>My Assigned Reports</Text>
            {loading ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading assigned reports...</Text>
              </View>
            ) : assignedReports.length > 0 ? (
              <>
                <View style={styles.counterContainer}>
                  <Text style={styles.counterText}>
                    {assignedReports.length} {assignedReports.length === 1 ? 'Report' : 'Reports'} Assigned
                  </Text>
                </View>
                <ScrollView 
                  style={styles.scrollView}
                  contentContainerStyle={styles.scrollViewContent}
                  refreshControl={
                    <RefreshControl
                      refreshing={refreshing}
                      onRefresh={onRefresh}
                      colors={['#2AADAD']}
                      tintColor="#2AADAD"
                      progressViewOffset={10}
                    />
                  }
                >
                  {assignedReports.map((report) => (
                    <AssignedReportCard 
                      key={report.docId}
                      report={report}
                      onOpenMaps={() => openInGoogleMaps(report)}
                      onComplete={() => handleComplete(report.id, report.docId)}
                    />
                  ))}
                </ScrollView>
              </>
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="map-outline" size={64} color="#2AADAD" />
                <Text style={styles.emptyText}>No assigned reports</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0e0e0e',
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  content: {
    flex: 1,
  },
  header: {
    padding: 20,
    backgroundColor: 'rgba(26, 26, 26, 0.8)',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  headerContent: {
    flex: 1,
    marginLeft: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(26, 26, 26, 0.8)',
    paddingHorizontal: 16,
    paddingBottom: 8,
    position: 'relative',
    height: 60,
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    zIndex: 1,
  },
  activeTab: {
    backgroundColor: 'transparent',
  },
  tabText: {
    color: '#888',
    fontWeight: '600',
  },
  activeTabText: {
    color: '#fff',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 8,
    left: 16,
    width: width / 2 - 40,
    height: 4,
    backgroundColor: '#2AADAD',
    borderRadius: 2,
    zIndex: 0,
  },
  section: {
    padding: 20,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingBottom: 20,
  },
  cardsContainer: {
    flex: 1,
    height: 500,
    marginBottom: 20,
  },
  card: {
    backgroundColor: 'rgba(26, 26, 26, 0.8)',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  activeCard: {
    zIndex: 2,
    elevation: 6,
  },
  inactiveCard: {
    zIndex: 1,
    elevation: 4,
    transform: [{ scale: 0.95 }],
    opacity: 0.7,
  },
  hiddenCard: {
    display: 'none',
  },
  cardImage: {
    width: '100%',
    height: 200,
  } as ImageStyle,
  cardContent: {
    padding: 16,
  },
  cardCategory: {
    color: '#2AADAD',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  cardDescription: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 20,
  },
  cardAddress: {
    color: '#aaa',
    fontSize: 12,
    marginBottom: 2,
  },
  cardCounty: {
    color: '#aaa',
    fontSize: 12,
    marginBottom: 2,
  },
  cardEircode: {
    color: '#aaa',
    fontSize: 12,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  approveButton: {
    backgroundColor: '#22c55e',
  },
  declineButton: {
    backgroundColor: '#ef4444',
  },
  mapsButton: {
    backgroundColor: '#2AADAD',
  },
  completeButton: {
    backgroundColor: '#22c55e',
  },
  buttonText: {
    color: '#fff',
    marginLeft: 8,
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  emptyText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
  },
  errorText: {
    fontSize: 18,
    color: 'red',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(42, 173, 173, 0.2)',
  },
  backButtonText: {
    color: '#2AADAD',
    fontSize: 16,
    fontWeight: 'bold',
  },
  counterContainer: {
    marginBottom: 16,
    alignItems: 'center',
  },
  counterText: {
    color: '#2AADAD',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
}); 