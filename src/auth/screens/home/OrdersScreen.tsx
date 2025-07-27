import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Image, FlatList, TextInput, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';

const PastOrdersScreen = () => {
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

  // Dummy data for past orders
  const pastOrders = [
    {
      id: '1',
      kitchenImage: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60',
      kitchenName: 'Grandma\'s Kitchen',
      orderDate: '15 July 2023, 12:30 PM',
      orderPrice: '₹450',
      status: 'Delivered',
      rating: 4,
      items: [
        { name: 'Butter Chicken', type: 'non-veg', quantity: 2 },
        { name: 'Dal Makhani', type: 'veg', quantity: 1 },
        { name: 'Garlic Naan', type: 'veg', quantity: 4 }
      ]
    },
    {
      id: '2',
      kitchenImage: 'https://images.unsplash.com/photo-1556911220-bff31c812dba?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60',
      kitchenName: 'Spice Delight',
      orderDate: '10 July 2023, 7:15 PM',
      orderPrice: '₹320',
      status: 'Delivered',
      rating: null,
      items: [
        { name: 'Paneer Tikka', type: 'veg', quantity: 1 },
        { name: 'Veg Biryani', type: 'veg', quantity: 2 },
        { name: 'Raita', type: 'veg', quantity: 2 }
      ]
    },
    {
      id: '3',
      kitchenImage: 'https://images.unsplash.com/photo-1606787366850-de6330128bfc?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60',
      kitchenName: 'Coastal Flavors',
      orderDate: '5 July 2023, 1:45 PM',
      orderPrice: '₹580',
      status: 'On the way',
      items: [
        { name: 'Fish Curry', type: 'non-veg', quantity: 1 },
        { name: 'Prawn Fry', type: 'non-veg', quantity: 1 },
        { name: 'Steamed Rice', type: 'veg', quantity: 2 },
        { name: 'Kokum Juice', type: 'veg', quantity: 2 }
      ]
    }
  ];

  // Filter orders based on search and status
  const filteredOrders = pastOrders.filter(order => {
    const matchesSearch = order.kitchenName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         order.items.some(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesFilter = activeFilter === 'all' || 
                         (activeFilter === 'delivered' && order.status === 'Delivered') ||
                         (activeFilter === 'pending' && order.status !== 'Delivered');
    
    return matchesSearch && matchesFilter;
  });

  const handleReorder = (order) => {
    navigation.navigate('CartScreen', { 
      reorderedItems: order.items,
      kitchenName: order.kitchenName,
      kitchenImage: order.kitchenImage
    });
  };

  const VegNonVegIcon = ({ type }) => (
    <View style={[
      styles.vegNonVegIcon,
      type === 'veg' ? styles.vegIcon : styles.nonVegIcon
    ]}>
      <View style={[
        styles.vegNonVegInner,
        type === 'veg' ? styles.vegInner : styles.nonVegInner
      ]} />
    </View>
  );

  const renderOrderItem = ({ item }) => (
    <View style={styles.orderCard}>
      <View style={styles.kitchenHeader}>
        <Image source={{ uri: item.kitchenImage }} style={styles.kitchenImage} />
        <View style={styles.kitchenInfo}>
          <Text style={styles.kitchenName}>{item.kitchenName}</Text>
          <Text style={styles.orderDate}>{item.orderDate}</Text>
          </View>
            {item.rating ? (
              <View style={styles.ratedStars}>
                {[...Array(5)].map((_, i) => (
                  <Icon 
                    key={i} 
                    name={i < item.rating ? 'star' : 'star-outline'} 
                    size={14} 
                    color="#FFD700" 
                  />
                ))}
              </View>
            ) : (
              <TouchableOpacity 
                style={styles.rateButton}
                onPress={() => navigation.navigate('RateOrderScreen', { item })}
              >
                <Text style={styles.rateButtonText}>Rate Order</Text>
              </TouchableOpacity>
            )}
        </View>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.itemsContainer}
      >
        {item.items.map((foodItem, index) => (
          <View key={index} style={styles.foodItem}>
            <VegNonVegIcon type={foodItem.type} />
            <Text style={styles.itemText}>{foodItem.name} (x{foodItem.quantity})</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.orderFooter}>
        <View style={styles.priceStatusContainer}>
          <Text style={styles.orderPrice}>{item.orderPrice}</Text>
          <View style={[
            styles.statusBadge,
            item.status === 'Delivered' ? styles.deliveredBadge : styles.onthewayBadge
          ]}>
            <Text style={styles.statusText}>{item.status}</Text>
          </View>
        </View>

        <View style={styles.actionButtons}>
          {item.status !== 'Delivered' ? (
            <TouchableOpacity style={styles.trackButton}>
              <Text style={styles.trackButtonText}>Track Order</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={styles.reorderButton}
              onPress={() => handleReorder(item)}
            >
              <Text style={styles.reorderButtonText}>Reorder</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            style={styles.viewButton}
            onPress={() => navigation.navigate('OrderDetailsScreen', { order: item })}
          >
            <Text style={styles.viewButtonText}>View Details</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>Your Orders</Text>
        <View style={{ width: 24 }} />
      </View>
      
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Icon name="search" size={20} color="#888" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by kitchen or dish..."
          placeholderTextColor="#888"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Icon name="close-circle" size={20} color="#888" />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <TouchableOpacity 
          style={[styles.filterTab, activeFilter === 'all' && styles.activeFilterTab]}
          onPress={() => setActiveFilter('all')}
        >
          <Text style={[styles.filterText, activeFilter === 'all' && styles.activeFilterText]}>All Orders</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.filterTab, activeFilter === 'delivered' && styles.activeFilterTab]}
          onPress={() => setActiveFilter('delivered')}
        >
          <Text style={[styles.filterText, activeFilter === 'delivered' && styles.activeFilterText]}>Delivered</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.filterTab, activeFilter === 'pending' && styles.activeFilterTab]}
          onPress={() => setActiveFilter('pending')}
        >
          <Text style={[styles.filterText, activeFilter === 'pending' && styles.activeFilterText]}>Pending</Text>
        </TouchableOpacity>
      </View>

      {filteredOrders.length > 0 ? (
        <FlatList
          data={filteredOrders}
          renderItem={renderOrderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Icon name="fast-food-outline" size={60} color="#ddd" />
          <Text style={styles.emptyText}>No orders found</Text>
          <Text style={styles.emptySubtext}>Try adjusting your search or filters</Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 10,
    margin: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  filterContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginHorizontal: 16,
    marginBottom: 16,
  },
  filterTab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  activeFilterTab: {
    backgroundColor: '#E65C00',
  },
  filterText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  activeFilterText: {
    color: '#fff',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  kitchenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  kitchenImage: {
    width: 50,
    height: 50,
    borderRadius: 10,
    marginRight: 12,
  },
  kitchenInfo: {
    flex: 1,
  },
  kitchenName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  orderDate: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  ratingBadge: {
    alignItems: 'flex-end',
  },
  ratedStars: {
    flexDirection: 'row',
  },
  rateButton: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  rateButtonText: {
    fontSize: 12,
    color: '#E65C00',
    fontWeight: '600',
  },
  itemsContainer: {
    paddingVertical: 8,
  },
  foodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
  },
  itemText: {
    fontSize: 13,
    color: '#555',
    marginLeft: 6,
  },
  vegNonVegIcon: {
    width: 14,
    height: 14,
    borderRadius: 2,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vegIcon: {
    borderColor: 'green',
  },
  nonVegIcon: {
    borderColor: 'red',
  },
  vegNonVegInner: {
    width: 8,
    height: 8,
    borderRadius: 1,
  },
  vegInner: {
    backgroundColor: 'green',
  },
  nonVegInner: {
    backgroundColor: 'red',
  },
  orderFooter: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
  },
  priceStatusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  deliveredBadge: {
    backgroundColor: '#e3f9e5',
  },
  onthewayBadge: {
    backgroundColor: '#fff3e0',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  trackButton: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 8,
    marginRight: 8,
    alignItems: 'center',
  },
  trackButtonText: {
    color: '#333',
    fontWeight: '600',
    fontSize: 14,
  },
  reorderButton: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 8,
    marginRight: 8,
    alignItems: 'center',
  },
  reorderButtonText: {
    color: '#E65C00',
    fontWeight: '600',
    fontSize: 14,
  },
  viewButton: {
    flex: 1,
    backgroundColor: '#E65C00',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  viewButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});

export default PastOrdersScreen;