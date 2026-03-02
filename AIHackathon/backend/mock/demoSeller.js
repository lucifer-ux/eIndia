/**
 * Demo Seller Configuration and Mock Data
 * This is the test account for development and demo purposes
 */

// Demo Seller Credentials
const DEMO_CREDENTIALS = {
  email: 'demo@eindia.com',
  password: 'demo123'
};

// Demo Seller Profile
const DEMO_SELLER = {
  sellerId: 'demo-seller-001',
  email: 'demo@eindia.com',
  displayName: 'Demo Electronics Store',
  companyName: 'Demo Electronics Pvt Ltd',
  isLoggedIn: true,
  loginProvider: 'demo',
  ordersPlaced: 12,
  orderVolume: 8750.50,
  lastLoginAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  createdAt: '2024-01-15T10:30:00Z',
  // Additional profile data
  profile: {
    description: 'Your trusted source for electronic components and development boards',
    location: 'Bangalore, India',
    rating: 4.8,
    totalOrders: 15420,
    responseTime: '< 2 hours',
    warranty: '2 Years',
    returnPolicy: '30-day no questions asked',
    establishedYear: 2018,
    verified: true
  }
};

// Mock Inventory for Demo Store
const DEMO_INVENTORY = [
  { sku: 'DEMO-STM32-001', name: 'STM32F407VGT6 ARM Cortex-M4', category: 'Microcontrollers', price: 12.50, stock: 500, specs: ['168MHz', '1MB Flash', '192KB RAM'] },
  { sku: 'DEMO-ESP32-001', name: 'ESP32-WROOM-32 WiFi + Bluetooth', category: 'Microcontrollers', price: 4.99, stock: 1000, specs: ['Dual Core 240MHz', 'WiFi + BT', '520KB RAM'] },
  { sku: 'DEMO-ARDUINO-001', name: 'Arduino Uno R3', category: 'Microcontrollers', price: 23.99, stock: 800, specs: ['ATmega328P', '16MHz', 'Digital/Analog I/O'] },
  { sku: 'DEMO-RPI4-001', name: 'Raspberry Pi 4 Model B 4GB', category: 'Single Board Computers', price: 55.00, stock: 300, specs: ['4GB RAM', '4-Core ARM', '4K Output'] },
  { sku: 'DEMO-DHT22-001', name: 'DHT22 Temperature Humidity Sensor', category: 'Sensors', price: 8.50, stock: 1500, specs: ['-40 to 80°C', '0-100% RH', 'Digital Output'] },
  { sku: 'DEMO-HCSR04-001', name: 'HC-SR04 Ultrasonic Distance Sensor', category: 'Sensors', price: 3.99, stock: 2000, specs: ['2-400cm Range', '5V DC', 'Trig/Echo'] },
  { sku: 'DEMO-LCD-001', name: 'LCD 1602 16x2 Character Display', category: 'Displays', price: 6.99, stock: 800, specs: ['16x2 Chars', 'I2C/SPI', 'Blue Backlight'] },
  { sku: 'DEMO-OLED-001', name: '0.96" OLED Display 128x64', category: 'Displays', price: 7.99, stock: 1000, specs: ['128x64 Pixels', 'I2C/SPI', 'SSD1306'] },
  { sku: 'DEMO-LM2596-001', name: 'LM2596 DC-DC Buck Converter', category: 'Power', price: 2.49, stock: 2500, specs: ['3A Output', 'Adjustable', 'Input 4-35V'] },
  { sku: 'DEMO-TP4056-001', name: 'TP4056 Li-ion Battery Charger', category: 'Power', price: 1.99, stock: 3000, specs: ['1A Charge', 'Micro USB', 'Protection'] }
];

// Mock Recent Inquiries
const DEMO_INQUIRIES = [
  {
    id: 1,
    name: 'John Doe',
    company: 'TechCorp',
    avatar: 'JD',
    time: '2 mins ago',
    status: 'NEW REQUEST',
    statusColor: 'blue',
    message: "I'm looking for a bulk order of STM32F407 microcontrollers, specifically the VGT6 variant. Need about 500 units by next week. Do you have stock?",
    componentDetected: 'STM32F407VGT6',
    aiResponse: "Hello John, thanks for your inquiry. Yes, we have 500+ units of STM32F407VGT6 in stock at our warehouse. We can expedite shipping to meet your next week deadline. Would you like a formal quote for 500 units?",
    quantity: 500,
    urgency: 'high'
  },
  {
    id: 2,
    name: 'Sarah Miller',
    company: 'ProtoLabs',
    avatar: 'SM',
    time: '15 mins ago',
    status: 'PENDING REVIEW',
    statusColor: 'yellow',
    message: "Do you carry any high-voltage ceramic capacitors rated for 2kV? Looking for 100pF.",
    componentDetected: 'Ceramic Capacitor 100pF 2kV',
    aiResponse: null,
    quantity: 100,
    urgency: 'medium'
  },
  {
    id: 3,
    name: 'Rajesh Kumar',
    company: 'InnovateTech',
    avatar: 'RK',
    time: '1 hour ago',
    status: 'RESPONDED',
    statusColor: 'green',
    message: "Need 50 units of ESP32-WROOM for our IoT project. What's the best price you can offer?",
    componentDetected: 'ESP32-WROOM',
    aiResponse: "Hi Rajesh, we can offer you a bulk discount for 50 units. The price would be $4.50 per unit instead of $4.99. Total: $225. Would you like to proceed?",
    quantity: 50,
    urgency: 'medium'
  },
  {
    id: 4,
    name: 'Priya Sharma',
    company: 'RoboTech',
    avatar: 'PS',
    time: '3 hours ago',
    status: 'CONVERTED',
    statusColor: 'purple',
    message: "Looking for Raspberry Pi 4 4GB models. Need 20 units for educational purposes.",
    componentDetected: 'Raspberry Pi 4 4GB',
    aiResponse: "Hello Priya, we have 300+ Raspberry Pi 4 4GB in stock. For educational orders, we offer a 10% discount. Price: $49.50 per unit. Total: $990.",
    quantity: 20,
    urgency: 'low'
  }
];

// Mock Order History
const DEMO_ORDERS = [
  {
    id: 'ORD-2024-001',
    customer: 'John Doe',
    company: 'TechCorp',
    product: 'STM32F407VGT6',
    quantity: 100,
    unitPrice: 12.50,
    total: 1250.00,
    status: 'DELIVERED',
    date: '2024-02-15',
    shipping: 'Express'
  },
  {
    id: 'ORD-2024-002',
    customer: 'Sarah Miller',
    company: 'ProtoLabs',
    product: 'ESP32-WROOM-32',
    quantity: 50,
    unitPrice: 4.99,
    total: 249.50,
    status: 'SHIPPED',
    date: '2024-02-18',
    shipping: 'Standard'
  },
  {
    id: 'ORD-2024-003',
    customer: 'Rajesh Kumar',
    company: 'InnovateTech',
    product: 'Raspberry Pi 4 4GB',
    quantity: 25,
    unitPrice: 55.00,
    total: 1375.00,
    status: 'PROCESSING',
    date: '2024-02-20',
    shipping: 'Express'
  },
  {
    id: 'ORD-2024-004',
    customer: 'Priya Sharma',
    company: 'RoboTech',
    product: 'Arduino Uno R3',
    quantity: 30,
    unitPrice: 23.99,
    total: 719.70,
    status: 'PENDING',
    date: '2024-02-21',
    shipping: 'Standard'
  },
  {
    id: 'ORD-2024-005',
    customer: 'Mike Chen',
    company: 'SmartDevices',
    product: 'DHT22 Sensor',
    quantity: 200,
    unitPrice: 8.50,
    total: 1700.00,
    status: 'PENDING',
    date: '2024-02-21',
    shipping: 'Express'
  }
];

// Mock Statistics
const DEMO_STATS = {
  queries24h: 342,
  queriesGrowth: '+18%',
  resolvedQueries: 318,
  resolutionRate: '93%',
  avgResponseTime: '3m',
  conversionRate: '28%',
  topComponents: [
    { name: 'ESP32-WROOM', queries: 1240, percentage: 85 },
    { name: 'Arduino Uno R3', queries: 980, percentage: 65 },
    { name: 'STM32F407', queries: 756, percentage: 50 },
    { name: 'Raspberry Pi 4', queries: 620, percentage: 40 },
    { name: 'DHT22 Sensor', queries: 480, percentage: 32 }
  ],
  monthlyRevenue: [
    { month: 'Jan', revenue: 5200 },
    { month: 'Feb', revenue: 6800 },
    { month: 'Mar', revenue: 8750 },
    { month: 'Apr', revenue: 7200 },
    { month: 'May', revenue: 9100 },
    { month: 'Jun', revenue: 10500 }
  ]
};

// Mock AI Agent Configuration
const DEMO_AGENT_CONFIG = {
  prompt: `Act as a senior technical sales engineer for Demo Electronics Store. Your goal is to assist engineers and procurement managers in finding the right electronic components. Always verify stock availability before making commitments. Provide accurate technical specifications and competitive pricing. Be professional, helpful, and concise in your responses.

Key guidelines:
- Always check stock before confirming availability
- Offer bulk discounts for orders > 50 units
- Mention warranty (2 years) and return policy (30 days)
- Provide technical specs when asked
- Suggest alternatives if item is out of stock`,
  isActive: true,
  autoRespond: false,
  responseTone: 'professional',
  languages: ['en', 'hi']
};

module.exports = {
  DEMO_CREDENTIALS,
  DEMO_SELLER,
  DEMO_INVENTORY,
  DEMO_INQUIRIES,
  DEMO_ORDERS,
  DEMO_STATS,
  DEMO_AGENT_CONFIG
};