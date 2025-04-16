import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  Alert,
  Dimensions,
  SafeAreaView,
  Platform,
  RefreshControl,
} from "react-native";
import { Image as ExpoImage, ImageStyle } from 'expo-image';
import { useAuth } from "../../contexts/AuthContext";
import { db, auth } from "../../config/firebase";
import { collection, query, where, getDocs, orderBy, limit, startAfter, DocumentSnapshot, onSnapshot, deleteDoc, doc, updateDoc, getDoc } from "firebase/firestore";
import { router } from 'expo-router';
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import AuthButton from '../../components/AuthButton';
import { sendPasswordResetEmail } from "firebase/auth";
import ModernButton from '../../components/ModernButton';

const { width } = Dimensions.get('window');

type Report = {
  id: string;
  imageUrl: string;
  category: string;
  description: string;
  status: "pending" | "approved" | "completed";
  timestamp: any; // for ordering
  addressLine1?: string;
  addressLine2?: string;
  county?: string;
  eircode?: string;
};

type Message = {
  id: string;
  userId: string;
  title: string;
  content: string;
  type: 'approval' | 'decline' | 'general';
  reportId?: string;
  createdAt: any;
  read: boolean;
  expiresAt: any;
};

export default function AccountScreen() {
  const { user, isAdmin, refreshUserRole } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastVisible, setLastVisible] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [activeTab, setActiveTab] = useState<'account' | 'messages' | 'history'>('account');
  const [showWelcomeMessage, setShowWelcomeMessage] = useState(true);
  const REPORTS_PER_PAGE = 5;
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const logOut = async () => {
    try {
      await auth.signOut();
      router.push('/auth/LoginScreen');
    } catch (error) {
      Alert.alert('Error', 'Failed to sign out. Please try again.');
    }
  };

  const fetchReports = useCallback(async (isRefreshing = false) => {
    if (!user) return;

    if (isRefreshing) {
      setRefreshing(true);
      setLastVisible(null);
      setHasMore(true);
    } else {
      setLoadingMore(true);
    }

    try {
      let q;
      
      if (isRefreshing || !lastVisible) {
        // Initial fetch or refresh
        q = query(
          collection(db, "reports"),
          where("userId", "==", user.uid),
          where("status", "in", ["approved", "completed"]),
          orderBy("timestamp", "desc"),
          limit(REPORTS_PER_PAGE)
        );
      } else {
        // Pagination fetch
        q = query(
          collection(db, "reports"),
          where("userId", "==", user.uid),
          where("status", "in", ["approved", "completed"]),
          orderBy("timestamp", "desc"),
          startAfter(lastVisible),
          limit(REPORTS_PER_PAGE)
        );
      }

      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        setHasMore(false);
      } else {
        const newReports = snapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
        })) as Report[];
        
        setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
        
        if (isRefreshing) {
          // For refresh, completely replace the reports
          setReports(newReports);
        } else {
          // For pagination, add only new reports and update existing ones
          setReports(prevReports => {
            // Create a map of existing reports for quick lookup
            const existingReportsMap = new Map(
              prevReports.map(report => [report.id, report])
            );
            
            // Process new reports
            const updatedReports = [...prevReports];
            
            newReports.forEach(newReport => {
              const existingReportIndex = updatedReports.findIndex(
                report => report.id === newReport.id
              );
              
              if (existingReportIndex === -1) {
                // Report doesn't exist, add it
                updatedReports.push(newReport);
              } else {
                // Report exists, update it if status changed
                if (updatedReports[existingReportIndex].status !== newReport.status) {
                  updatedReports[existingReportIndex] = newReport;
                }
              }
            });
            
            return updatedReports;
          });
        }
      }
    } catch (err) {
      console.error("Failed to fetch reports", err);
      Alert.alert(
        "Error",
        "Failed to load your reports. Please try again later."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
      setIsLoadingMore(false);
    }
  }, [user, lastVisible]);

  const handleLoadMore = () => {
    if (!loadingMore && hasMore && !isLoadingMore) {
      setIsLoadingMore(true);
      fetchReports();
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // Refresh user role from Firestore
      if (user) {
        await refreshUserRole();
      }
      
      // Reset the reports array before fetching new data
      setReports([]);
      await fetchReports(true);
    } catch (error) {
      console.error("Error refreshing data:", error);
      Alert.alert("Error", "Failed to refresh data. Please try again.");
    } finally {
      setRefreshing(false);
    }
  };

  const handleResetPassword = async () => {
    if (!user || !user.email) {
      Alert.alert('Error', 'No user email found.');
      return;
    }

    try {
      await sendPasswordResetEmail(auth, user.email);
      Alert.alert(
        'Password Reset Email Sent', 
        'Check your inbox for instructions to reset your password. The email may take a few minutes to arrive.'
      );
    } catch (error: any) {
      Alert.alert('Error', `Failed to send reset email: ${error.message}`);
    }
  };

  const navigateToAdmin = () => {
    router.push('/admin/dashboard');
  };

  const fetchMessages = useCallback(() => {
    if (!user) return;

    try {
      const q = query(
        collection(db, "messages"),
        where("userId", "==", user.uid),
        where("expiresAt", ">", new Date()),
        orderBy("expiresAt", "desc")
      );

      return onSnapshot(q, (snapshot) => {
        const newMessages = snapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
        })) as Message[];
        setMessages(newMessages);
      });
    } catch (error) {
      console.error("Error fetching messages:", error);
      Alert.alert(
        "Error",
        "Failed to load your messages. Please try again later."
      );
    }
  }, [user]);

  const handleMessageRead = async (messageId: string) => {
    try {
      const messageRef = doc(db, "messages", messageId);
      await updateDoc(messageRef, {
        read: true
      });
      
      // Update the local state to reflect the change
      setMessages(prevMessages => 
        prevMessages.map(msg => 
          msg.id === messageId ? { ...msg, read: true } : msg
        )
      );
    } catch (error) {
      console.error("Error marking message as read:", error);
      Alert.alert(
        "Error",
        "Failed to mark message as read. Please try again."
      );
    }
  };

  // Update the handleDismiss function to delete the message
  const handleDismiss = async (messageId: string) => {
    try {
      // Delete the message from Firestore
      const messageRef = doc(db, "messages", messageId);
      await deleteDoc(messageRef);
      
      // Update the local state to remove the message
      setMessages(prevMessages => 
        prevMessages.filter(msg => msg.id !== messageId)
      );
    } catch (error) {
      console.error("Error dismissing message:", error);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchReports(true);
    const unsubscribe = fetchMessages();
    
    // Hide welcome message after 5 seconds
    const welcomeTimer = setTimeout(() => {
      setShowWelcomeMessage(false);
    }, 5000);
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
      clearTimeout(welcomeTimer);
    };
  }, [user, fetchReports, fetchMessages]);

  if (!user) {
    return (
      <View style={styles.centered}>
        <BlurView intensity={20} tint="dark" style={styles.notLoggedInContainer}>
          <Text style={styles.notLoggedInText}>You must be logged in to view your account.</Text>
          <ModernButton
            title="Sign In"
            variant="primary"
            size="medium"
            onPress={() => router.push('/auth/LoginScreen')}
            containerStyle={styles.signInButton}
          />
        </BlurView>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2AADAD" />
        <Text style={styles.loadingText}>Loading your account...</Text>
        <Text style={styles.loadingSubtext}>This may take a moment</Text>
      </View>
    );
  }

  const renderAccountTab = () => (
    <View style={styles.tabContent}>
      <BlurView intensity={20} tint="dark" style={styles.accountCard}>
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>
              {user.displayName ? user.displayName.charAt(0).toUpperCase() : user.email?.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            {user?.displayName && (
              <Text style={styles.profileName}>{user.displayName}</Text>
            )}
            <Text style={styles.profileEmail}>{user.email}</Text>
            <Text style={styles.profileRole}>
              Role: {user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'User'}
              {isAdmin && ' (Admin Access)'}
            </Text>
            <Text style={styles.refreshHint}>Pull down to refresh role information</Text>
          </View>
        </View>
        
        <View style={styles.accountActions}>
          {isAdmin && (
            <ModernButton
              title="Admin Dashboard"
              variant="primary"
              size="medium"
              onPress={navigateToAdmin}
              containerStyle={styles.actionButton}
            />
          )}
          <ModernButton
            title="Reset Password"
            variant="secondary"
            size="medium"
            onPress={handleResetPassword}
            containerStyle={styles.actionButton}
          />
          <ModernButton
            title="Sign Out"
            variant="secondary"
            size="medium"
            onPress={logOut}
            containerStyle={styles.actionButton}
          />
        </View>
      </BlurView>
      
      <BlurView intensity={20} tint="dark" style={styles.statsCard}>
        <Text style={styles.statsTitle}>Your Activity</Text>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{reports.length}</Text>
            <Text style={styles.statLabel}>Reports</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{messages.length}</Text>
            <Text style={styles.statLabel}>Messages</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {reports.filter(r => r.status === 'completed').length}
            </Text>
            <Text style={styles.statLabel}>Resolved</Text>
          </View>
        </View>
      </BlurView>
    </View>
  );

  const renderMessagesTab = () => (
    <View style={styles.tabContent}>
      {messages.length > 0 ? (
        messages.map((message) => (
          <BlurView 
            key={message.id} 
            intensity={20} 
            tint="dark" 
            style={[
              styles.messageCard,
              !message.read && styles.unreadMessage
            ]}
          >
            <TouchableOpacity
              style={styles.messageTouchable}
              onPress={() => handleMessageRead(message.id)}
            >
              <View style={styles.messageHeader}>
                <View style={styles.messageTitleContainer}>
                  <Text style={styles.messageTitle}>{message.title}</Text>
                  {!message.read && <View style={styles.unreadDot} />}
                </View>
                <Text style={styles.messageTime}>
                  {new Date(message.createdAt?.toDate()).toLocaleDateString()}
                </Text>
              </View>
              <Text style={styles.messageContent}>{message.content}</Text>
              <View style={styles.messageFooter}>
                <Text style={styles.messageType}>
                  {message.type === 'approval' ? 'Approval' : 
                   message.type === 'decline' ? 'Decline' : 'General'}
                </Text>
                <TouchableOpacity 
                  style={styles.dismissButton}
                  onPress={() => handleDismiss(message.id)}
                >
                  <Text style={styles.dismissButtonText}>Dismiss</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </BlurView>
        ))
      ) : (
        <BlurView intensity={20} tint="dark" style={styles.emptyContainer}>
          <Ionicons name="mail-outline" size={48} color="rgba(255,255,255,0.3)" />
          <Text style={styles.emptyText}>No messages</Text>
          <Text style={styles.emptySubtext}>You'll receive notifications here about your reports</Text>
        </BlurView>
      )}
    </View>
  );

  const renderHistoryTab = () => (
    <View style={styles.tabContent}>
      {reports.length > 0 ? (
        <View style={styles.reportsContainer}>
          {reports.map((item) => (
            <BlurView key={item.id} intensity={20} tint="dark" style={styles.reportCard}>
              <View style={styles.reportHeader}>
                <View style={styles.reportCategoryContainer}>
                  <Text style={styles.reportCategory}>{item.category}</Text>
                </View>
                <View style={[
                  styles.statusBadge,
                  item.status === 'completed' ? styles.completedBadge : styles.approvedBadge
                ]}>
                  <Text style={styles.statusText}>
                    {item.status === 'completed' ? 'Completed' : 'Approved'}
                  </Text>
                </View>
              </View>
              
              <View style={styles.reportImageContainer}>
                <ExpoImage source={{ uri: item.imageUrl }} style={styles.reportImage} />
              </View>
              
              <View style={styles.reportContent}>
                <Text style={styles.reportDescription} numberOfLines={3}>
                  {item.description}
                </Text>
                
                <View style={styles.reportDetails}>
                  {item.county && (
                    <View style={styles.detailItem}>
                      <Ionicons name="location" size={16} color="#2AADAD" />
                      <Text style={styles.detailText}>{item.county}</Text>
                    </View>
                  )}
                  
                  <View style={styles.detailItem}>
                    <Ionicons name="calendar" size={16} color="#2AADAD" />
                    <Text style={styles.detailText}>
                      {item.timestamp ? new Date(item.timestamp.toDate()).toLocaleDateString() : 'Unknown date'}
                    </Text>
                  </View>
                </View>
              </View>
            </BlurView>
          ))}
          
          {loadingMore && (
            <View style={styles.loadingMoreContainer}>
              <ActivityIndicator size="small" color="#2AADAD" />
              <Text style={styles.loadingMoreText}>Loading more reports...</Text>
            </View>
          )}
          
          {!hasMore && reports.length > 0 && (
            <BlurView intensity={20} tint="dark" style={styles.endOfListContainer}>
              <Text style={styles.endOfListText}>You've reached the end of your reports</Text>
            </BlurView>
          )}
          
          {/* Add a manual load more button for better control */}
          {hasMore && !loadingMore && reports.length > 0 && (
            <TouchableOpacity 
              style={styles.loadMoreButton}
              onPress={handleLoadMore}
            >
              <Text style={styles.loadMoreButtonText}>Load More Reports</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <BlurView intensity={20} tint="dark" style={styles.emptyContainer}>
          <Ionicons name="document-text-outline" size={48} color="rgba(255,255,255,0.3)" />
          <Text style={styles.emptyText}>No reports found</Text>
          <Text style={styles.emptySubtext}>Your approved reports will appear here</Text>
          <ModernButton
            title="Create a Report"
            variant="primary"
            size="small"
            onPress={() => router.push('/report')}
            containerStyle={styles.createReportButton}
          />
        </BlurView>
      )}
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
      
      <ScrollView 
        style={styles.fullScreenScroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={["#2AADAD"]}
            tintColor="#2AADAD"
            progressViewOffset={Platform.OS === 'ios' ? 0 : 0}
          />
        }
        contentContainerStyle={styles.fullScreenScrollContent}
      >
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Account</Text>
          </View>
          
          {showWelcomeMessage && (
            <BlurView intensity={20} tint="dark" style={styles.welcomeContainer}>
              <Text style={styles.welcomeTitle}>Welcome to Your Account!</Text>
              <Text style={styles.welcomeText}>
                Manage your profile, view your reports, and check your messages all in one place.
              </Text>
              <TouchableOpacity 
                style={styles.dismissButton}
                onPress={() => setShowWelcomeMessage(false)}
              >
                <Text style={styles.dismissButtonText}>Got it</Text>
              </TouchableOpacity>
            </BlurView>
          )}
          
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'account' && styles.activeTab]}
              onPress={() => setActiveTab('account')}
            >
              <Ionicons 
                name="person" 
                size={24} 
                color={activeTab === 'account' ? '#2AADAD' : 'rgba(255,255,255,0.6)'} 
              />
              <Text style={[styles.tabText, activeTab === 'account' && styles.activeTabText]}>
                Profile
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.tab, activeTab === 'messages' && styles.activeTab]}
              onPress={() => setActiveTab('messages')}
            >
              <Ionicons 
                name="mail" 
                size={24} 
                color={activeTab === 'messages' ? '#2AADAD' : 'rgba(255,255,255,0.6)'} 
              />
              <Text style={[styles.tabText, activeTab === 'messages' && styles.activeTabText]}>
                Messages
                {messages.length > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{messages.length}</Text>
                  </View>
                )}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.tab, activeTab === 'history' && styles.activeTab]}
              onPress={() => setActiveTab('history')}
            >
              <Ionicons 
                name="time" 
                size={24} 
                color={activeTab === 'history' ? '#2AADAD' : 'rgba(255,255,255,0.6)'} 
              />
              <Text style={[styles.tabText, activeTab === 'history' && styles.activeTabText]}>
                History
              </Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.content}>
            {activeTab === 'account' && renderAccountTab()}
            {activeTab === 'messages' && renderMessagesTab()}
            {activeTab === 'history' && renderHistoryTab()}
          </View>
        </SafeAreaView>
      </ScrollView>
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
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0e0e0e",
  },
  notLoggedInContainer: {
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    width: '80%',
  },
  notLoggedInText: {
    color: "#fff",
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  signInButton: {
    width: '100%',
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
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#2AADAD',
  },
  tabText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    marginTop: 4,
  },
  activeTabText: {
    color: '#2AADAD',
    fontWeight: 'bold',
  },
  badge: {
    backgroundColor: '#2AADAD',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    top: -8,
    right: -12,
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  tabContent: {
    padding: 16,
  },
  accountCard: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 16,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  avatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(42, 173, 173, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    color: '#2AADAD',
    fontSize: 24,
    fontWeight: 'bold',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  profileEmail: {
    color: 'rgba(235, 235, 245, 0.6)',
    fontSize: 14,
  },
  profileRole: {
    color: '#2AADAD',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 4,
  },
  refreshHint: {
    color: 'rgba(235, 235, 245, 0.4)',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 2,
  },
  accountActions: {
    padding: 16,
  },
  actionButton: {
    marginBottom: 12,
  },
  statsCard: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 16,
  },
  statsTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    color: '#2AADAD',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    color: 'rgba(235, 235, 245, 0.6)',
    fontSize: 12,
  },
  messageCard: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 16,
  },
  messageTouchable: {
    padding: 16,
  },
  unreadMessage: {
    borderLeftWidth: 4,
    borderLeftColor: '#2AADAD',
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  messageTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  messageTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
  messageContent: {
    color: 'rgba(235, 235, 245, 0.8)',
    fontSize: 14,
    marginBottom: 12,
    lineHeight: 20,
  },
  messageTime: {
    color: 'rgba(235, 235, 245, 0.4)',
    fontSize: 12,
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  messageType: {
    color: '#2AADAD',
    fontSize: 12,
    fontWeight: 'bold',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2AADAD',
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
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    color: 'rgba(235, 235, 245, 0.6)',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  createReportButton: {
    width: '100%',
  },
  reportsContainer: {
    marginBottom: 20,
  },
  reportCard: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 16,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  reportCategoryContainer: {
    backgroundColor: 'rgba(42, 173, 173, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  reportCategory: {
    color: '#2AADAD',
    fontSize: 14,
    fontWeight: 'bold',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  completedBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
  },
  approvedBadge: {
    backgroundColor: 'rgba(42, 173, 173, 0.2)',
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  reportImageContainer: {
    height: 180,
    width: '100%',
  },
  reportImage: {
    width: '100%',
    height: '100%',
    contentFit: 'cover',
  } as ImageStyle,
  reportContent: {
    padding: 12,
  },
  reportDescription: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  reportDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 8,
  },
  detailText: {
    color: 'rgba(235, 235, 245, 0.6)',
    fontSize: 12,
    marginLeft: 4,
  },
  loadingMoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  loadingMoreText: {
    color: 'rgba(235, 235, 245, 0.6)',
    marginLeft: 8,
  },
  endOfListContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    marginTop: 8,
  },
  endOfListText: {
    color: 'rgba(235, 235, 245, 0.6)',
    fontSize: 14,
  },
  loadMoreButton: {
    backgroundColor: 'rgba(42, 173, 173, 0.2)',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(42, 173, 173, 0.4)',
  },
  loadMoreButtonText: {
    color: '#2AADAD',
    fontSize: 14,
    fontWeight: 'bold',
  },
  fullScreenScroll: {
    flex: 1,
  },
  fullScreenScrollContent: {
    flexGrow: 1,
  },
});
