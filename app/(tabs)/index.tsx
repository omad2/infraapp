import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  Image, 
  TouchableOpacity, 
  ActivityIndicator, 
  RefreshControl, 
  ScrollView,
  Dimensions,
  Platform,
  SafeAreaView
} from 'react-native';
import { ImageStyle } from 'expo-image';
import { db } from '../../config/firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { router } from 'expo-router';
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import ModernButton from '../../components/ModernButton';

const { width } = Dimensions.get('window');

type CompletedReport = {
  id: string;
  docId: string;
  imageUrl: string;
  category: string;
  description: string;
  timestamp: any;
  addressLine1?: string;
  county?: string;
};

type CountryLeaderboard = {
  county: string;
  points: number;
  completedReports: number;
};

export default function HomeScreen() {
  const { user, isAdmin } = useAuth();
  const [completedReports, setCompletedReports] = useState<CompletedReport[]>([]);
  const [leaderboardData, setLeaderboardData] = useState<CountryLeaderboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [approvedReportsCount, setApprovedReportsCount] = useState(0);
  const [totalReportsCount, setTotalReportsCount] = useState(0);

  // Fetch the 5 most recent completed reports
  const fetchCompletedReports = async () => {
    setLoading(true);
    try {
      // First try with the composite query
      try {
        const q = query(
          collection(db, "reports"),
          where("status", "==", "completed"),
          orderBy("timestamp", "desc"),
          limit(5)
        );
        
        const snapshot = await getDocs(q);
        const reports = snapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.data().id,
          docId: doc.id,
        })) as CompletedReport[];
        
        setCompletedReports(reports);
      } catch (error: any) {
        // If the error is about missing index, use a workaround
        if (error.message && error.message.includes("requires an index")) {
          console.log("Index not available yet, using workaround");
          
          // Alternative approach: fetch all completed reports and sort in memory
          const q = query(
            collection(db, "reports"),
            where("status", "==", "completed")
          );
          
          const snapshot = await getDocs(q);
          const reports = snapshot.docs.map((doc) => ({
            ...doc.data(),
            id: doc.data().id,
            docId: doc.id,
          })) as CompletedReport[];
          
          // Sort by timestamp in memory and take the 5 most recent
          reports.sort((a, b) => {
            if (!a.timestamp || !b.timestamp) return 0;
            return b.timestamp.toDate().getTime() - a.timestamp.toDate().getTime();
          });
          
          setCompletedReports(reports.slice(0, 5));
        } else {
          // If it's a different error, rethrow it
          throw error;
        }
      }
    } catch (error) {
      console.error("Error fetching completed reports:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch the leaderboard data
  const fetchLeaderboardData = async () => {
    setLeaderboardLoading(true);
    try {
      // Get all completed reports
      const q = query(
        collection(db, "reports"),
        where("status", "==", "completed")
      );
      
      const snapshot = await getDocs(q);
      
      // Process the data to count reports by county
      const countyData: Record<string, CountryLeaderboard> = {};
      
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        const county = data.county || "Unknown";
        
        if (!countyData[county]) {
          countyData[county] = {
            county,
            points: 0,
            completedReports: 0
          };
        }
        
        // Each completed report is worth 10 points
        countyData[county].points += 10;
        countyData[county].completedReports += 1;
      });
      
      // Convert to array and sort by points
      const leaderboardArray = Object.values(countyData).sort((a, b) => b.points - a.points);
      
      // Take only the top 3 for the preview
      setLeaderboardData(leaderboardArray.slice(0, 3));
    } catch (error) {
      console.error("Error fetching leaderboard data:", error);
    } finally {
      setLeaderboardLoading(false);
    }
  };

  // Fetch report counts for statistics
  const fetchReportCounts = async () => {
    try {
      // Get all approved reports
      const approvedQuery = query(
        collection(db, "reports"),
        where("status", "==", "approved")
      );
      
      const approvedSnapshot = await getDocs(approvedQuery);
      setApprovedReportsCount(approvedSnapshot.size);
      
      // Get all completed reports
      const completedQuery = query(
        collection(db, "reports"),
        where("status", "==", "completed")
      );
      
      const completedSnapshot = await getDocs(completedQuery);
      
      // Total reports = approved + completed
      setTotalReportsCount(approvedSnapshot.size + completedSnapshot.size);
    } catch (error) {
      console.error("Error fetching report counts:", error);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchCompletedReports();
    fetchLeaderboardData();
    fetchReportCounts();
    
    // Update date every minute
    const interval = setInterval(() => {
      setCurrentDate(new Date());
    }, 60000);
    
    return () => clearInterval(interval);
  }, []);

  // Navigate to feed page
  const navigateToFeed = () => {
    router.push('/feed');
  };

  // Navigate to leaderboard page
  const navigateToLeaderboard = () => {
    router.push('../leaderboard');
  };

  // Handle refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        fetchCompletedReports(),
        fetchLeaderboardData(),
        fetchReportCounts()
      ]);
    } catch (error) {
      console.error("Error refreshing data:", error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Get greeting based on time of day
  const getGreeting = () => {
    const hour = currentDate.getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  // Format date
  const formatDate = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    };
    return date.toLocaleDateString('en-US', options);
  };

  // Format short date for reports
  const formatShortDate = (timestamp: any) => {
    if (!timestamp || !timestamp.toDate) return '';
    const date = timestamp.toDate();
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Render completed report item
  const renderCompletedReport = ({ item }: { item: CompletedReport }) => (
    <TouchableOpacity 
      style={styles.reportCard}
      onPress={() => {
        // For now, just navigate to the feed page
        // In a future update, you can implement a detailed view for each report
        router.push('/feed');
      }}
    >
      <Image source={{ uri: item.imageUrl }} style={styles.reportImage} />
      <View style={styles.reportInfo}>
        <Text style={styles.category}>{item.category}</Text>
        <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
        <View style={styles.reportFooter}>
          <Text style={styles.county}>{item.county}</Text>
          {item.timestamp && (
            <Text style={styles.timestamp}>
              {formatShortDate(item.timestamp)}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  // Render leaderboard item
  const renderLeaderboardItem = ({ item, index }: { item: CountryLeaderboard, index: number }) => (
    <View style={styles.leaderboardItem}>
      <View style={styles.rankContainer}>
        {index === 0 && <Text style={styles.rank}>🥇</Text>}
        {index === 1 && <Text style={styles.rank}>🥈</Text>}
        {index === 2 && <Text style={styles.rank}>🥉</Text>}
      </View>
      <View style={styles.countryInfo}>
        <Text style={styles.countryName}>{item.county}</Text>
        <Text style={styles.reportCount}>{item.completedReports} reports</Text>
      </View>
      <Text style={styles.points}>{item.points} pts</Text>
    </View>
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
        <ScrollView 
          style={styles.scrollView}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#2AADAD']}
              tintColor="#2AADAD"
            />
          }
        >
          <View style={styles.headerContainer}>
            <View>
              <Text style={styles.greeting}>{getGreeting()}, {user?.displayName || 'User'}</Text>
              <Text style={styles.dateText}>{formatDate(currentDate)}</Text>
            </View>
            <View style={styles.profileButton}>
              <Ionicons name="person-circle-outline" size={32} color="#FFFFFF" />
            </View>
          </View>
          
          <View style={styles.statsContainer}>
            <BlurView intensity={20} tint="dark" style={styles.statsCard}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{approvedReportsCount}</Text>
                <Text style={styles.statLabel}>Recent Reports</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{leaderboardData.length}</Text>
                <Text style={styles.statLabel}>Active Counties</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{totalReportsCount}</Text>
                <Text style={styles.statLabel}>Total Reports</Text>
              </View>
            </BlurView>
          </View>
          
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recently Completed Reports</Text>
              <TouchableOpacity onPress={navigateToFeed}>
                <Text style={styles.viewAllText}>View All</Text>
              </TouchableOpacity>
            </View>
            
            {loading ? (
              <ActivityIndicator size="large" color="#2AADAD" style={styles.loader} />
            ) : completedReports.length > 0 ? (
              <FlatList
                data={completedReports}
                renderItem={renderCompletedReport}
                keyExtractor={(item) => item.docId}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.listContainer}
              />
            ) : (
              <BlurView intensity={20} tint="dark" style={styles.emptyCard}>
                <Text style={styles.emptyText}>No completed reports yet</Text>
                <Text style={styles.emptySubtext}>Be the first to report an issue</Text>
              </BlurView>
            )}
          </View>
          
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Top Counties</Text>
              <TouchableOpacity onPress={navigateToLeaderboard}>
                <Text style={styles.viewAllText}>View All</Text>
              </TouchableOpacity>
            </View>
            
            {leaderboardLoading ? (
              <ActivityIndicator size="large" color="#2AADAD" style={styles.loader} />
            ) : leaderboardData.length > 0 ? (
              <BlurView intensity={20} tint="dark" style={styles.leaderboardContainer}>
                {leaderboardData.map((item, index) => (
                  <View key={item.county} style={[
                    styles.leaderboardPreviewItem,
                    index === leaderboardData.length - 1 && { borderBottomWidth: 0 }
                  ]}>
                    <View style={styles.rankContainer}>
                      {index === 0 && <Text style={styles.rank}>🥇</Text>}
                      {index === 1 && <Text style={styles.rank}>🥈</Text>}
                      {index === 2 && <Text style={styles.rank}>🥉</Text>}
                    </View>
                    <View style={styles.countryInfo}>
                      <Text style={styles.countryName}>{item.county}</Text>
                      <Text style={styles.reportCount}>{item.completedReports} reports</Text>
                    </View>
                    <Text style={styles.points}>{item.points} pts</Text>
                  </View>
                ))}
              </BlurView>
            ) : (
              <BlurView intensity={20} tint="dark" style={styles.emptyCard}>
                <Text style={styles.emptyText}>No leaderboard data available yet</Text>
                <Text style={styles.emptySubtext}>Complete reports to see rankings</Text>
              </BlurView>
            )}
          </View>
          
          <ModernButton 
            title="View All Reports"
            icon="arrow-forward"
            iconPosition="right"
            variant="primary"
            size="large"
            fullWidth
            onPress={navigateToFeed}
            containerStyle={styles.viewAllButton}
          />
        </ScrollView>
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
  scrollView: {
    flex: 1,
    padding: 16,
  },
  headerContainer: { 
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  greeting: { 
    color: '#fff', 
    fontSize: 24, 
    fontWeight: 'bold',
  },
  dateText: {
    color: 'rgba(235, 235, 245, 0.6)',
    fontSize: 14,
    marginTop: 4,
  },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  statsContainer: {
    marginBottom: 24,
  },
  statsCard: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  statLabel: {
    color: 'rgba(235, 235, 245, 0.6)',
    fontSize: 12,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginHorizontal: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  viewAllText: {
    color: '#2AADAD',
    fontSize: 14,
    fontWeight: 'bold',
  },
  listContainer: {
    paddingBottom: 8,
  },
  reportCard: {
    backgroundColor: 'rgba(26, 26, 26, 0.8)',
    borderRadius: 16,
    marginRight: 16,
    width: 220,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  reportImage: {
    width: '100%',
    height: 120,
    contentFit: 'cover',
  } as ImageStyle,
  reportInfo: {
    padding: 12,
  },
  category: {
    color: '#2AADAD',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  description: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 8,
  },
  reportFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  county: {
    color: '#aaa',
    fontSize: 12,
  },
  timestamp: {
    color: '#aaa',
    fontSize: 12,
  },
  loader: {
    marginVertical: 20,
  },
  emptyCard: {
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  emptyText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  emptySubtext: {
    color: 'rgba(235, 235, 245, 0.6)',
    fontSize: 14,
  },
  viewAllButton: {
    marginBottom: 24,
  },
  leaderboardContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  leaderboardPreviewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  leaderboardItem: {
    backgroundColor: 'rgba(26, 26, 26, 0.8)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  rankContainer: {
    width: 40,
    alignItems: 'center',
  },
  rank: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  countryInfo: {
    flex: 1,
    marginLeft: 12,
  },
  countryName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  reportCount: {
    color: '#aaa',
    fontSize: 12,
  },
  points: {
    color: '#2AADAD',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
