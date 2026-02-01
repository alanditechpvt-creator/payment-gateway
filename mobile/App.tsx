import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from './src/store/auth';

// Screens
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import TransactionsScreen from './src/screens/TransactionsScreen';
import UsersScreen from './src/screens/UsersScreen';
import WalletScreen from './src/screens/WalletScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import PayinScreen from './src/screens/PayinScreen';
import PayoutScreen from './src/screens/PayoutScreen';
import TransferScreen from './src/screens/TransferScreen';
import PaymentWebViewScreen from './src/screens/PaymentWebViewScreen';
import CCPaymentScreen from './src/screens/CCPaymentScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

const DarkTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: '#6366f1',
    background: '#0a0a0f',
    card: '#111118',
    text: '#ffffff',
    border: '#27272a',
    notification: '#ef4444',
  },
};

function MainTabs({ navigation }: any) {
  const { user } = useAuthStore();
  const canManageUsers = ['ADMIN', 'WHITE_LABEL', 'MASTER_DISTRIBUTOR'].includes(user?.role || '');

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home';
          
          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Transactions') {
            iconName = focused ? 'document-text' : 'document-text-outline';
          } else if (route.name === 'Users') {
            iconName = focused ? 'people' : 'people-outline';
          } else if (route.name === 'Wallet') {
            iconName = focused ? 'wallet' : 'wallet-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }
          
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#6366f1',
        tabBarInactiveTintColor: '#71717a',
        tabBarStyle: {
          backgroundColor: '#111118',
          borderTopColor: '#27272a',
          paddingBottom: 8,
          paddingTop: 8,
          height: 60,
        },
        headerStyle: {
          backgroundColor: '#111118',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: '600',
        },
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={DashboardScreen} 
        options={{ 
          title: 'Dashboard',
          headerShown: false,
        }} 
      />
      <Tab.Screen 
        name="Transactions" 
        component={TransactionsScreen}
        options={{
          headerShown: false,
        }}
      />
      {canManageUsers && (
        <Tab.Screen 
          name="Users" 
          component={UsersScreen} 
          options={{ 
            title: 'Users',
            headerShown: false,
          }}
        />
      )}
      <Tab.Screen 
        name="Wallet" 
        component={WalletScreen}
        options={{
          headerShown: false,
        }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{
          headerShown: false,
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const { isAuthenticated } = useAuthStore();
  
  return (
    <QueryClientProvider client={queryClient}>
      <NavigationContainer theme={DarkTheme}>
        <StatusBar style="light" />
        <Stack.Navigator
          screenOptions={{
            contentStyle: { backgroundColor: '#0a0a0f' },
            headerStyle: {
              backgroundColor: '#111118',
            },
            headerTintColor: '#fff',
            headerTitleStyle: {
              fontWeight: '600',
              fontSize: 18,
            },
            headerBackTitleVisible: false,
          }}
        >
          {isAuthenticated ? (
            <>
              <Stack.Screen 
                name="Main" 
                component={MainTabs}
                options={{ headerShown: false }}
              />
              <Stack.Screen 
                name="Payin" 
                component={PayinScreen}
                options={{ title: 'Create Payin' }}
              />
              <Stack.Screen 
                name="Payout" 
                component={PayoutScreen}
                options={{ title: 'Create Payout' }}
              />
              <Stack.Screen 
                name="Transfer" 
                component={TransferScreen}
                options={{ title: 'Transfer Funds' }}
              />
              <Stack.Screen 
                name="CCPayment" 
                component={CCPaymentScreen}
                options={{ title: 'CC Bill Payment' }}
              />
              <Stack.Screen 
                name="PaymentWebView" 
                component={PaymentWebViewScreen}
                options={{ title: 'Payment', headerBackTitle: 'Cancel' }}
              />
            </>
          ) : (
            <>
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </QueryClientProvider>
  );
}

