import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  ActivityIndicator, 
  TouchableOpacity, 
  SafeAreaView,
  Dimensions,
  RefreshControl
} from 'react-native';
import { db } from '../config/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

const { width } = Dimensions.get('window');

type CountyStats = {
  county: string;
  points: number;
  completedReports: number;
};

export default function LeaderboardScreen() {
  const [leaderboardData, setLeaderboardData] = useState<CountyStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchLeaderboardData();
  }, []);

  const fetchLeaderboardData = async () => {
    setLoading(true);
    try {
      // Get all completed reports
      const q = query(
        collection(db, "reports"),
        where("status", "==", "completed")
      );
      
      const snapshot = await getDocs(q);
      
      // Process the data to count reports by county
      const countyData: Record<string, CountyStats> = {};
      
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
      setLeaderboardData(leaderboardArray);
    } catch (error) {
      console.error("Error fetching leaderboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchLeaderboardData();
    } catch (error) {
      console.error("Error refreshing data:", error);
    } finally {
      setRefreshing(false);
    }
  };

  const renderLeaderboardItem = ({ item, index }: { item: CountyStats, index: number }) => (
    <BlurView intensity={20} tint="dark" style={styles.leaderboardItem}>
      <View style={styles.rankContainer}>
        {index === 0 && <Text style={styles.rank}>🥇</Text>}
        {index === 1 && <Text style={styles.rank}>🥈</Text>}
        {index === 2 && <Text style={styles.rank}>🥉</Text>}
        {index > 2 && <Text style={styles.rankNumber}>{index + 1}</Text>}
      </View>
      <View style={styles.countyInfo}>
        <Text style={styles.countyName}>{item.county}</Text>
        <Text style={styles.reportCount}>{item.completedReports} reports completed</Text>
      </View>
      <View style={styles.pointsContainer}>
        <Text style={styles.points}>{item.points}</Text>
        <Text style={styles.pointsLabel}>pts</Text>
      </View>
    </BlurView>
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
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#2AADAD" />
          </TouchableOpacity>
          <Text style={styles.title}>County Leaderboard</Text>
          <View style={styles.placeholder} />
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#2AADAD" style={styles.loader} />
        ) : leaderboardData.length > 0 ? (
          <FlatList
            data={leaderboardData}
            renderItem={renderLeaderboardItem}
            keyExtractor={(item) => item.county}
            contentContainerStyle={styles.listContainer}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#2AADAD']}
                tintColor="#2AADAD"
              />
            }
          />
        ) : (
          <BlurView intensity={20} tint="dark" style={styles.emptyCard}>
            <Text style={styles.emptyText}>No completed reports yet</Text>
            <Text style={styles.emptySubtext}>Complete reports to see rankings</Text>
          </BlurView>
        )}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  placeholder: {
    width: 40,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  listContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  leaderboardItem: {
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
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(42, 173, 173, 0.2)',
  },
  rank: {
    fontSize: 24,
  },
  rankNumber: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  countyInfo: {
    flex: 1,
    marginLeft: 16,
  },
  countyName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  reportCount: {
    color: 'rgba(235, 235, 245, 0.6)',
    fontSize: 14,
    marginTop: 4,
  },
  pointsContainer: {
    alignItems: 'center',
  },
  points: {
    color: '#2AADAD',
    fontSize: 20,
    fontWeight: 'bold',
  },
  pointsLabel: {
    color: 'rgba(235, 235, 245, 0.6)',
    fontSize: 12,
  },
  loader: {
    marginTop: 40,
  },
  emptyCard: {
    margin: 16,
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
}); 