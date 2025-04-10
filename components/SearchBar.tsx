import React, { useState } from "react";
import { View, TextInput, TouchableOpacity, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface SearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  onCancel?: () => void;
  showCancel?: boolean;
}

const SearchBar: React.FC<SearchBarProps> = ({ 
  onSearch,
  placeholder = "Search...",
  onCancel,
  showCancel = false
}) => {
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = () => {
    if (searchQuery.trim().length > 0) {
      onSearch(searchQuery.trim());
    }
  };

  const handleCancel = () => {
    setSearchQuery("");
    if (onCancel) {
      onCancel();
    }
  };

  return (
    <View className="flex-row items-center bg-gray-800 rounded-lg px-3 py-2 mb-4">
      <Ionicons name="search" size={20} color="#9CA3AF" />
      <TextInput
        className="flex-1 text-white font-poppins py-1 px-2"
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        value={searchQuery}
        onChangeText={setSearchQuery}
        onSubmitEditing={handleSearch}
      />
      {searchQuery.length > 0 && (
        <TouchableOpacity onPress={() => setSearchQuery("")} className="p-1">
          <Ionicons name="close-circle" size={20} color="#9CA3AF" />
        </TouchableOpacity>
      )}
      {showCancel && (
        <TouchableOpacity onPress={handleCancel} className="ml-2">
          <Text className="text-gray-400 font-poppins">Cancel</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

export default SearchBar;