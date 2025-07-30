// Email validation using basic regex
export const validateEmail = (email) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email.trim());
};

// Indian phone number validation (supports country code too)
export const validatePhoneNumber = (phone) => {
  // Accepts formats like +919876543210 or 9876543210
  const cleaned = phone.replace(/\s+/g, '');
  const regex = /^(?:\+91|91)?[6-9]\d{9}$/;
  return regex.test(cleaned);
};