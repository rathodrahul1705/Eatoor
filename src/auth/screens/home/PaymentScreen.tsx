import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Linking
} from "react-native";

const UPI_APPS = [
  {
    name: "Google Pay",
    scheme: "tez://upi/pay",
    icon: "https://img.icons8.com/color/96/google-pay.png"
  },
  {
    name: "PhonePe",
    scheme: "phonepe://pay",
    icon: "https://img.icons8.com/color/96/phonepe.png"
  }
];

const PaymentScreen = () => {
  const [status, setStatus] = useState("idle");
  const [loading, setLoading] = useState(false);
  const pollingRef = useRef(null);

  const createOrder = async () => {
    const res = await fetch("https://eatoor.com/api/create-order/");
    return await res.json();
  };

  const pay = async (app) => {
    try {
      setStatus("processing");
      setLoading(true);

      const order = await createOrder();

      // 🔥 Cashfree UPI Intent URL
      const upiUrl = `${app.scheme}?pa=test@upi&pn=Eatoor&tr=${order.order_id}&am=${order.amount}&cu=INR`;

      await Linking.openURL(upiUrl);

      startPolling(order.order_id);

    } catch (err) {
      console.log(err);
      setStatus("failed");
      setLoading(false);
    }
  };

  const startPolling = (orderId) => {
    pollingRef.current = setInterval(async () => {
      const res = await fetch(`https://eatoor.com/api/check-status/${orderId}/`);
      const data = await res.json();

      if (data.status === "success") {
        clearInterval(pollingRef.current);
        setStatus("success");
        setLoading(false);
      }

      if (data.status === "failed") {
        clearInterval(pollingRef.current);
        setStatus("failed");
        setLoading(false);
      }
    }, 3000);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pay ₹100</Text>

      {status === "idle" &&
        UPI_APPS.map((app, i) => (
          <TouchableOpacity key={i} style={styles.btn} onPress={() => pay(app)}>
            <Image source={{ uri: app.icon }} style={styles.icon} />
            <Text>{app.name}</Text>
          </TouchableOpacity>
        ))}

      {status === "processing" && (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
          <Text>Waiting for payment...</Text>
        </View>
      )}

      {status === "success" && <Text>🎉 Success</Text>}
      {status === "failed" && <Text>❌ Failed</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 20
  },
  title: {
    fontSize: 22,
    textAlign: "center",
    marginBottom: 30
  },
  btn: {
    backgroundColor: "#FF824F",
    padding: 15,
    borderRadius: 10
  },
  text: {
    color: "#fff",
    textAlign: "center",
    fontSize: 16
  }
});

export default PaymentScreen;