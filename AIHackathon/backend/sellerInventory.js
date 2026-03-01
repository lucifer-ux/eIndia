// Mock ElectroFind Assured Seller - Always has everything in stock
const ELECTROFIND_ASSURED_SELLER = {
  sellerId: 'electrofind-assured-001',
  name: 'ElectroFind Assured',
  displayName: 'ElectroFind Assured',
  email: 'assured@electrofind.com',
  isAssured: true,
  rating: 4.9,
  totalOrders: 15420,
  responseTime: '< 1 hour',
  warranty: '2 Years',
  returnPolicy: '30-day no questions asked'
};

// Comprehensive inventory - covers all major electronics categories
const assuredInventory = [
  // Microcontrollers
  { sku: 'STM32F407VGT6', name: 'STM32F407VGT6 ARM Cortex-M4', category: 'Microcontrollers', price: 12.50, stock: 5000, specs: ['168MHz', '1MB Flash', '192KB RAM'] },
  { sku: 'ESP32-WROOM-32', name: 'ESP32-WROOM-32 WiFi + Bluetooth', category: 'Microcontrollers', price: 4.99, stock: 10000, specs: ['Dual Core 240MHz', 'WiFi + BT', '520KB RAM'] },
  { sku: 'Arduino-UNO-R3', name: 'Arduino Uno R3', category: 'Microcontrollers', price: 23.99, stock: 8000, specs: ['ATmega328P', '16MHz', 'Digital/Analog I/O'] },
  { sku: 'Raspberry-Pi-4-4GB', name: 'Raspberry Pi 4 Model B 4GB', category: 'Single Board Computers', price: 55.00, stock: 3000, specs: ['4GB RAM', '4-Core ARM', '4K Output'] },
  
  // Sensors
  { sku: 'DHT22', name: 'DHT22 Temperature Humidity Sensor', category: 'Sensors', price: 8.50, stock: 15000, specs: ['-40 to 80°C', '0-100% RH', 'Digital Output'] },
  { sku: 'HC-SR04', name: 'HC-SR04 Ultrasonic Distance Sensor', category: 'Sensors', price: 3.99, stock: 20000, specs: ['2-400cm Range', '5V DC', 'Trig/Echo'] },
  { sku: 'MPU6050', name: 'MPU6050 6-Axis Accelerometer Gyroscope', category: 'Sensors', price: 5.49, stock: 12000, specs: ['3-axis Accel', '3-axis Gyro', 'I2C Interface'] },
  
  // Displays
  { sku: 'LCD-1602', name: 'LCD 1602 16x2 Character Display', category: 'Displays', price: 6.99, stock: 8000, specs: ['16x2 Chars', 'I2C/SPI', 'Blue Backlight'] },
  { sku: 'OLED-0.96', name: '0.96" OLED Display 128x64', category: 'Displays', price: 7.99, stock: 10000, specs: ['128x64 Pixels', 'I2C/SPI', 'SSD1306'] },
  { sku: 'TFT-2.8', name: '2.8" TFT Touch Display', category: 'Displays', price: 24.99, stock: 5000, specs: ['320x240', 'Touch Screen', 'ILI9341'] },
  
  // Power
  { sku: 'LM2596-DC-DC', name: 'LM2596 DC-DC Buck Converter', category: 'Power', price: 2.49, stock: 25000, specs: ['3A Output', 'Adjustable', 'Input 4-35V'] },
  { sku: 'TP4056', name: 'TP4056 Li-ion Battery Charger', category: 'Power', price: 1.99, stock: 30000, specs: ['1A Charge', 'Micro USB', 'Protection'] },
  { sku: '18650-BATTERY', name: '18650 Li-ion Battery 2600mAh', category: 'Power', price: 8.99, stock: 5000, specs: ['2600mAh', '3.7V', 'Protected'] },
  
  // Passive Components
  { sku: 'RES-KIT-400', name: 'Resistor Kit 400pcs 1/4W', category: 'Passive', price: 5.99, stock: 15000, specs: ['1/4W', '1% Precision', '20 Values'] },
  { sku: 'CAP-KIT-500', name: 'Ceramic Capacitor Kit 500pcs', category: 'Passive', price: 6.99, stock: 12000, specs: ['50V', '10pF-100nF', '20 Values'] },
  { sku: 'LED-KIT-300', name: '5mm LED Assorted Kit 300pcs', category: 'Passive', price: 7.99, stock: 10000, specs: ['5mm', 'Red/Green/Blue/Yellow/White', '20mA'] },
  
  // Modules
  { sku: 'RELAY-5V', name: '5V Relay Module 4-Channel', category: 'Modules', price: 6.49, stock: 8000, specs: ['4 Channel', '10A/250V', 'Optocoupler'] },
  { sku: 'MOTOR-DRIVER-L298N', name: 'L298N Dual H-Bridge Motor Driver', category: 'Modules', price: 5.99, stock: 6000, specs: ['Dual H-Bridge', '2A/Channel', '5-35V'] },
  { sku: 'SERVO-SG90', name: 'SG90 Micro Servo Motor', category: 'Modules', price: 3.99, stock: 15000, specs: ['9g', '180°', 'Tower Pro'] },
  
  // Communication
  { sku: 'NRF24L01', name: 'NRF24L01 Wireless Transceiver', category: 'Communication', price: 4.49, stock: 8000, specs: ['2.4GHz', '2Mbps', 'SPI Interface'] },
  { sku: 'SIM800L', name: 'SIM800L GSM GPRS Module', category: 'Communication', price: 12.99, stock: 4000, specs: ['Quad-Band', 'SMS/Voice', 'GPRS'] },
  { sku: 'HC-05', name: 'HC-05 Bluetooth Module', category: 'Communication', price: 6.99, stock: 7000, specs: ['Bluetooth 2.0', 'Serial', 'Master/Slave'] },
  
  // Tools
  { sku: 'SOLDERING-KIT', name: 'Basic Soldering Kit 60W', category: 'Tools', price: 24.99, stock: 3000, specs: ['60W', 'Adjustable Temp', '5 Tips'] },
  { sku: 'MULTIMETER-DT830', name: 'Digital Multimeter DT830B', category: 'Tools', price: 8.99, stock: 5000, specs: ['LCD Display', 'Voltage/Current', 'Diode Test'] },
  { sku: 'BREADBOARD-830', name: 'Solderless Breadboard 830 Points', category: 'Tools', price: 4.99, stock: 20000, specs: ['830 Tie Points', 'Self-Adhesive', 'White'] },
  
  // Cables & Connectors
  { sku: 'JUMPER-WIRES-M-M', name: 'Jumper Wires Male-Male 40pcs', category: 'Cables', price: 2.99, stock: 25000, specs: ['20cm', 'Male-Male', '40pcs'] },
  { sku: 'USB-CABLE-A-B', name: 'USB A to B Cable 1.5m', category: 'Cables', price: 3.99, stock: 15000, specs: ['1.5m', 'USB 2.0', 'Arduino Compatible'] },
  { sku: 'DUPONT-KIT-120', name: 'Dupont Connector Kit 120pcs', category: 'Cables', price: 5.99, stock: 10000, specs: ['2.54mm', 'M-M/M-F/F-F', 'Housing'] }
];

/**
 * Search inventory for matching products
 * @param {string} query - User search query
 * @returns {Array} Matching products with assured tag
 */
function searchAssuredInventory(query) {
  const searchTerms = query.toLowerCase().split(/\s+/);
  
  const matches = assuredInventory.filter(item => {
    const searchText = `${item.name} ${item.category} ${item.sku} ${item.specs.join(' ')}`.toLowerCase();
    return searchTerms.some(term => searchText.includes(term));
  });

  // Return top matches with assured seller info
  return matches.slice(0, 3).map(item => ({
    rank: 0, // Will be assigned later
    product_title: item.name,
    store: ELECTROFIND_ASSURED_SELLER.displayName,
    storeId: ELECTROFIND_ASSURED_SELLER.sellerId,
    isAssured: true,
    price: `$${item.price.toFixed(2)}`,
    rawPrice: item.price,
    buy_link: `#/chat-with-seller/${ELECTROFIND_ASSURED_SELLER.sellerId}/${item.sku}`,
    description: `${item.category} | In Stock: ${item.stock} units | ${item.specs.join(', ')}`,
    sku: item.sku,
    stock: item.stock,
    specs: item.specs,
    sellerRating: ELECTROFIND_ASSURED_SELLER.rating,
    responseTime: ELECTROFIND_ASSURED_SELLER.responseTime,
    warranty: ELECTROFIND_ASSURED_SELLER.warranty
  }));
}

/**
 * Get product by SKU
 */
function getProductBySku(sku) {
  return assuredInventory.find(item => item.sku === sku) || null;
}

/**
 * Get assured seller info
 */
function getAssuredSeller() {
  return ELECTROFIND_ASSURED_SELLER;
}

module.exports = {
  searchAssuredInventory,
  getProductBySku,
  getAssuredSeller,
  ELECTROFIND_ASSURED_SELLER,
  assuredInventory
};