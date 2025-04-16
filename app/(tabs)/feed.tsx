import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Modal,
  ScrollView,
  Alert,
  Dimensions,
  SafeAreaView,
} from 'react-native';
import { Image, ImageStyle } from 'expo-image';
import { db } from '../../config/firebase';
import { collection, query, where, getDocs, orderBy, doc, updateDoc, increment, getDoc, setDoc } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { irishCounties } from '../../utils/irishCounties';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import ModernButton from '../../components/ModernButton';

const { width } = Dimensions.get('window');

// Categories from report.tsx
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

type Report = {
  id: string;
  docId: string;
  imageUrl: string;
  category: string;
  description: string;
  status: "pending" | "approved" | "completed";
  timestamp: any;
  addressLine1?: string;
  addressLine2?: string;
  county?: string;
  eircode?: string;
  upvotes: number;
  userUpvoted?: boolean;
};

type FilterOptions = {
  search: string;
  sortBy: 'upvotes' | 'newest';
  category: string;
  county: string;
};

export default function FeedScreen() {
  const { user, isAdmin } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [filteredReports, setFilteredReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    search: '',
    sortBy: 'upvotes',
    category: '',
    county: '',
  });
  const [counties, setCounties] = useState<string[]>([]);
  const [userUpvotes, setUserUpvotes] = useState<Record<string, boolean>>({});
  const [showWelcomeMessage, setShowWelcomeMessage] = useState(true);
  const [showFilterTooltip, setShowFilterTooltip] = useState(true);

  // Fetch all approved reports
  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      // First, just filter by status without ordering
      const q = query(
        collection(db, "reports"),
        where("status", "==", "approved")
      );
      const snapshot = await getDocs(q);
      
      const reportsData = snapshot.docs.map((doc) => ({
        ...doc.data(),
        id: doc.data().id,
        docId: doc.id,
        upvotes: doc.data().upvotes || 0,
      })) as Report[];
      
      // Sort by timestamp in memory
      reportsData.sort((a, b) => {
        if (!a.timestamp || !b.timestamp) return 0;
        return b.timestamp.toDate().getTime() - a.timestamp.toDate().getTime();
      });
      
      setReports(reportsData);
      
      // Extract unique counties from reports and combine with irishCounties
      const reportCounties = Array.from(
        new Set(reportsData.map(report => report.county).filter(Boolean) as string[])
      );
      
      // Ensure all counties have "Co." prefix
      const normalizedReportCounties = reportCounties.map(county => 
        county.startsWith("Co. ") ? county : `Co. ${county}`
      );
      
      // Combine with irishCounties and remove duplicates
      const allCounties = Array.from(new Set([...normalizedReportCounties, ...irishCounties]));
      setCounties(allCounties);
      
      // If user is logged in, fetch their upvotes
      if (user) {
        const userUpvotesDoc = await getDoc(doc(db, "userUpvotes", user.uid));
        if (userUpvotesDoc.exists()) {
          // Convert numeric values to boolean for UI
          const upvotesData = userUpvotesDoc.data() as Record<string, number>;
          const booleanUpvotes: Record<string, boolean> = {};
          
          // Convert 1 to true, 0 or undefined to false
          Object.keys(upvotesData).forEach(reportId => {
            booleanUpvotes[reportId] = upvotesData[reportId] === 1;
          });
          
          setUserUpvotes(booleanUpvotes);
        }
      }
    } catch (error) {
      console.error("Error fetching reports:", error);
      // Show a more user-friendly error message
      Alert.alert(
        "Error",
        "Failed to load reports. Please try again later."
      );
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Apply filters to reports
  useEffect(() => {
    let filtered = [...reports];
    
    // Apply search filter
    if (filterOptions.search) {
      const searchLower = filterOptions.search.toLowerCase();
      filtered = filtered.filter(
        report => 
          report.description.toLowerCase().includes(searchLower) ||
          report.category.toLowerCase().includes(searchLower) ||
          (report.county && report.county.toLowerCase().includes(searchLower))
      );
    }
    
    // Apply category filter
    if (filterOptions.category) {
      filtered = filtered.filter(report => report.category === filterOptions.category);
    }
    
    // Apply county filter
    if (filterOptions.county) {
      // Normalize county for comparison
      const normalizedFilterCounty = filterOptions.county.startsWith("Co. ") 
        ? filterOptions.county 
        : `Co. ${filterOptions.county}`;
      
      filtered = filtered.filter(report => {
        const reportCounty = report.county || "";
        const normalizedReportCounty = reportCounty.startsWith("Co. ") 
          ? reportCounty 
          : `Co. ${reportCounty}`;
        
        return normalizedReportCounty === normalizedFilterCounty;
      });
    }
    
    // Apply sorting
    if (filterOptions.sortBy === 'upvotes') {
      filtered.sort((a, b) => b.upvotes - a.upvotes);
    } else {
      // Newest first (already sorted by timestamp in the query)
    }
    
    setFilteredReports(filtered);
  }, [reports, filterOptions]);

  // Handle upvote
  const handleUpvote = async (reportId: string, docId: string) => {
    if (!user) {
      Alert.alert(
        "Sign In Required",
        "Please sign in to upvote reports. Your upvotes help prioritize issues in your community.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Sign In", onPress: () => {/* Navigate to sign in */} }
        ]
      );
      return;
    }
    
    try {
      const hasUpvoted = userUpvotes[reportId];
      
      // Update report upvotes
      await updateDoc(doc(db, "reports", docId), {
        upvotes: increment(hasUpvoted ? -1 : 1)
      });
      
      // Update user's upvotes in Firebase
      const userUpvotesRef = doc(db, "userUpvotes", user.uid);
      const userUpvotesDoc = await getDoc(userUpvotesRef);
      
      if (userUpvotesDoc.exists()) {
        // Instead of storing a boolean, store a counter (1 for upvoted, 0 for not upvoted)
        await updateDoc(userUpvotesRef, {
          [reportId]: hasUpvoted ? 0 : 1
        });
      } else {
        // Create new document if it doesn't exist
        const newUserUpvotes: Record<string, number> = {};
        newUserUpvotes[reportId] = 1;
        await setDoc(userUpvotesRef, newUserUpvotes);
      }
      
      // Update local state - still using boolean for UI simplicity
      setUserUpvotes(prev => ({
        ...prev,
        [reportId]: !hasUpvoted
      }));
      
      // Refresh reports to get updated upvote count
      fetchReports();
    } catch (error) {
      console.error("Error upvoting report:", error);
      Alert.alert("Error", "Failed to upvote report. Please try again.");
    }
  };

  // Handle refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchReports();
    setRefreshing(false);
  }, [fetchReports]);

  // Initial fetch
  useEffect(() => {
    fetchReports();
    
    // Hide welcome message after 5 seconds
    const welcomeTimer = setTimeout(() => {
      setShowWelcomeMessage(false);
    }, 5000);
    
    // Hide filter tooltip after 8 seconds
    const tooltipTimer = setTimeout(() => {
      setShowFilterTooltip(false);
    }, 8000);
    
    return () => {
      clearTimeout(welcomeTimer);
      clearTimeout(tooltipTimer);
    };
  }, [fetchReports]);

  // Render report item
  const renderReportItem = ({ item }: { item: Report }) => {
    const hasUpvoted = userUpvotes[item.id] || false;
    
    // Ensure county has "Co." prefix
    const displayCounty = item.county 
      ? (item.county.startsWith("Co. ") ? item.county : `Co. ${item.county}`)
      : "";
    
    return (
      <BlurView intensity={20} tint="dark" style={styles.reportCard}>
        <View style={styles.reportHeader}>
          <View style={styles.categoryContainer}>
            <Text style={styles.category}>{item.category}</Text>
          </View>
          <Text style={styles.county}>{displayCounty}</Text>
        </View>
        
        <Image source={{ uri: item.imageUrl }} style={styles.reportImage} />
        
        <Text style={styles.description}>{item.description}</Text>
        
        <View style={styles.addressContainer}>
          <Text style={styles.address}>{item.addressLine1}</Text>
          {item.addressLine2 && <Text style={styles.address}>{item.addressLine2}</Text>}
          <Text style={styles.address}>{item.eircode}</Text>
        </View>
        
        <View style={styles.footer}>
          <TouchableOpacity 
            style={[styles.upvoteButton, hasUpvoted ? styles.upvotedButton : null]} 
            onPress={() => handleUpvote(item.id, item.docId)}
          >
            <Ionicons 
              name={hasUpvoted ? "arrow-up-circle" : "arrow-up-circle-outline"} 
              size={24} 
              color={hasUpvoted ? "#2AADAD" : "#fff"} 
            />
            <Text style={styles.upvoteCount}>{item.upvotes}</Text>
          </TouchableOpacity>
          
          <Text style={styles.timestamp}>
            {item.timestamp ? new Date(item.timestamp.toDate()).toLocaleDateString() : 'Unknown date'}
          </Text>
        </View>
      </BlurView>
    );
  };

  // Filter modal
  const renderFilterModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={filterModalVisible}
      onRequestClose={() => setFilterModalVisible(false)}
    >
      <View style={styles.modalContainer}>
        <BlurView intensity={20} tint="dark" style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filter Reports</Text>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setFilterModalVisible(false)}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.filterLabel}>Search</Text>
          <TextInput
            style={styles.filterInput}
            placeholder="Search by description, category, or county"
            placeholderTextColor="rgba(235, 235, 245, 0.6)"
            value={filterOptions.search}
            onChangeText={(text) => setFilterOptions({...filterOptions, search: text})}
          />
          
          <Text style={styles.filterLabel}>Sort By</Text>
          <View style={styles.sortButtons}>
            <TouchableOpacity
              style={[
                styles.sortButton,
                filterOptions.sortBy === 'upvotes' && styles.selectedSortButton
              ]}
              onPress={() => setFilterOptions({...filterOptions, sortBy: 'upvotes'})}
            >
              <Text style={styles.sortButtonText}>Most Upvoted</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.sortButton,
                filterOptions.sortBy === 'newest' && styles.selectedSortButton
              ]}
              onPress={() => setFilterOptions({...filterOptions, sortBy: 'newest'})}
            >
              <Text style={styles.sortButtonText}>Newest First</Text>
            </TouchableOpacity>
          </View>
          
          <Text style={styles.filterLabel}>Category</Text>
          <ScrollView style={styles.categoriesContainer}>
            <TouchableOpacity
              style={[
                styles.categoryButton,
                filterOptions.category === '' && styles.selectedCategoryButton
              ]}
              onPress={() => setFilterOptions({...filterOptions, category: ''})}
            >
              <Text style={styles.categoryButtonText}>All Categories</Text>
            </TouchableOpacity>
            {categories.map((category) => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.categoryButton,
                  filterOptions.category === category && styles.selectedCategoryButton
                ]}
                onPress={() => setFilterOptions({...filterOptions, category})}
              >
                <Text style={styles.categoryButtonText}>{category}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          
          <Text style={styles.filterLabel}>County</Text>
          <ScrollView style={styles.countiesContainer}>
            <TouchableOpacity
              style={[
                styles.countyButton,
                filterOptions.county === '' && styles.selectedCountyButton
              ]}
              onPress={() => setFilterOptions({...filterOptions, county: ''})}
            >
              <Text style={styles.countyButtonText}>All Counties</Text>
            </TouchableOpacity>
            {counties.map((county) => (
              <TouchableOpacity
                key={county}
                style={[
                  styles.countyButton,
                  filterOptions.county === county && styles.selectedCountyButton
                ]}
                onPress={() => setFilterOptions({...filterOptions, county})}
              >
                <Text style={styles.countyButtonText}>{county}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          
          <View style={styles.modalButtons}>
            <ModernButton
              title="Reset"
              variant="secondary"
              size="medium"
              onPress={() => setFilterOptions({
                search: '',
                sortBy: 'upvotes',
                category: '',
                county: '',
              })}
              containerStyle={styles.resetButton}
            />
            <ModernButton
              title="Apply"
              variant="primary"
              size="medium"
              onPress={() => setFilterModalVisible(false)}
              containerStyle={styles.applyButton}
            />
          </View>
        </BlurView>
      </View>
    </Modal>
  );

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
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Community Reports</Text>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setFilterModalVisible(true)}
          >
            <BlurView intensity={20} tint="dark" style={styles.filterButtonBlur}>
              <Ionicons name="filter" size={24} color="#fff" />
            </BlurView>
          </TouchableOpacity>
        </View>
        
        {showWelcomeMessage && (
          <BlurView intensity={20} tint="dark" style={styles.welcomeContainer}>
            <Text style={styles.welcomeTitle}>Welcome to Community Reports!</Text>
            <Text style={styles.welcomeText}>
              Browse issues reported by your community. Upvote to help prioritize important problems.
            </Text>
            <TouchableOpacity 
              style={styles.dismissButton}
              onPress={() => setShowWelcomeMessage(false)}
            >
              <Text style={styles.dismissButtonText}>Got it</Text>
            </TouchableOpacity>
          </BlurView>
        )}
        
        {showFilterTooltip && (
          <View style={styles.tooltipContainer}>
            <BlurView intensity={20} tint="dark" style={styles.tooltip}>
              <Text style={styles.tooltipText}>
                Tap the filter icon to search and filter reports
              </Text>
              <TouchableOpacity 
                style={styles.tooltipCloseButton}
                onPress={() => setShowFilterTooltip(false)}
              >
                <Ionicons name="close" size={16} color="#fff" />
              </TouchableOpacity>
            </BlurView>
          </View>
        )}
        
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2AADAD" />
            <Text style={styles.loadingText}>Loading community reports...</Text>
            <Text style={styles.loadingSubtext}>This may take a moment</Text>
          </View>
        ) : (
          <FlatList
            data={filteredReports}
            renderItem={renderReportItem}
            keyExtractor={(item) => item.docId}
            contentContainerStyle={styles.listContainer}
            refreshControl={
              <RefreshControl 
                refreshing={refreshing} 
                onRefresh={onRefresh}
                colors={['#2AADAD']}
                tintColor="#2AADAD"
              />
            }
            ListEmptyComponent={
              <BlurView intensity={20} tint="dark" style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No reports found</Text>
                <Text style={styles.emptySubtext}>Try adjusting your filters</Text>
                <View style={styles.emptyHelpContainer}>
                  <Text style={styles.emptyHelpText}>
                    • Clear your search terms{'\n'}
                    • Select "All Categories"{'\n'}
                    • Choose "All Counties"{'\n'}
                    • Pull down to refresh
                  </Text>
                </View>
                <ModernButton
                  title="Reset Filters"
                  variant="secondary"
                  size="small"
                  onPress={() => setFilterOptions({
                    search: '',
                    sortBy: 'upvotes',
                    category: '',
                    county: '',
                  })}
                  containerStyle={styles.emptyResetButton}
                />
              </BlurView>
            }
          />
        )}
        
        {filterModalVisible && (
          <View style={styles.modalOverlayContainer}>
            <BlurView intensity={50} tint="dark" style={styles.modalOverlay} />
            <View style={styles.modalOverlayBackground} />
          </View>
        )}
        
        {renderFilterModal()}
      </SafeAreaView>
    </LinearGradient>
  );
}

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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  filterButtonBlur: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  welcomeContainer: {
    margin: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  welcomeTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  welcomeText: {
    color: 'rgba(235, 235, 245, 0.8)',
    fontSize: 14,
    lineHeight: 20,
  },
  dismissButton: {
    alignSelf: 'flex-end',
    marginTop: 12,
  },
  dismissButtonText: {
    color: '#2AADAD',
    fontSize: 14,
    fontWeight: 'bold',
  },
  tooltipContainer: {
    position: 'absolute',
    top: 70,
    right: 16,
    zIndex: 10,
  },
  tooltip: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    maxWidth: 200,
  },
  tooltipText: {
    color: '#fff',
    fontSize: 14,
  },
  tooltipCloseButton: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
    fontWeight: 'bold',
  },
  loadingSubtext: {
    color: 'rgba(235, 235, 245, 0.6)',
    fontSize: 14,
    marginTop: 8,
  },
  listContainer: {
    padding: 16,
  },
  reportCard: {
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  categoryContainer: {
    backgroundColor: 'rgba(42, 173, 173, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  category: {
    color: '#2AADAD',
    fontWeight: 'bold',
  },
  county: {
    color: 'rgba(235, 235, 245, 0.6)',
  },
  reportImage: {
    width: '100%',
    height: 200,
    contentFit: 'cover',
  } as ImageStyle,
  description: {
    color: '#fff',
    padding: 16,
    fontSize: 16,
    lineHeight: 24,
  },
  addressContainer: {
    padding: 16,
    paddingTop: 0,
  },
  address: {
    color: 'rgba(235, 235, 245, 0.6)',
    fontSize: 14,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  upvoteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
  },
  upvotedButton: {
    backgroundColor: 'rgba(42, 173, 173, 0.2)',
  },
  upvoteCount: {
    color: '#fff',
    marginLeft: 8,
    fontWeight: 'bold',
  },
  timestamp: {
    color: 'rgba(235, 235, 245, 0.6)',
    fontSize: 12,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  filterLabel: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 8,
    marginTop: 16,
  },
  filterInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    color: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  sortButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sortButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  selectedSortButton: {
    backgroundColor: 'rgba(42, 173, 173, 0.3)',
    borderColor: '#2AADAD',
  },
  sortButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  categoriesContainer: {
    maxHeight: 150,
  },
  categoryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  selectedCategoryButton: {
    backgroundColor: 'rgba(42, 173, 173, 0.3)',
    borderColor: '#2AADAD',
  },
  categoryButtonText: {
    color: '#fff',
  },
  countiesContainer: {
    maxHeight: 150,
  },
  countyButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  selectedCountyButton: {
    backgroundColor: 'rgba(42, 173, 173, 0.3)',
    borderColor: '#2AADAD',
  },
  countyButtonText: {
    color: '#fff',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  resetButton: {
    flex: 1,
    marginRight: 8,
  },
  applyButton: {
    flex: 1,
    marginLeft: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  emptyText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptySubtext: {
    color: 'rgba(235, 235, 245, 0.6)',
    fontSize: 14,
    marginBottom: 16,
  },
  emptyHelpContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    width: '100%',
  },
  emptyHelpText: {
    color: 'rgba(235, 235, 245, 0.8)',
    fontSize: 14,
    lineHeight: 22,
  },
  emptyResetButton: {
    width: '100%',
  },
  modalOverlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
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
});
