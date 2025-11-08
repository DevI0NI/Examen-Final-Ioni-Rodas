import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Image,
  ActivityIndicator,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState([]);

  // 1. Función para consumir la API
  const fetchPhotos = async () => {
    try {
      const response = await fetch('https://picsum.photos/v2/list');
      const data = await response.json();
      setPhotos(data); // 2. Guardar los datos en el estado
    } catch (error) {
      console.error("Error fetching data: ", error);
    } finally {
      setLoading(false);
    }
  };

  // 3. useEffect para llamar la función cuando el componente se monta
  useEffect(() => {
    fetchPhotos();
  }, []);

  // 4. Renderizar cada elemento de la galería
  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <Image
        source={{ uri: item.download_url }}
        style={styles.image}
        resizeMode="cover"
      />
      <View style={styles.infoContainer}>
        <Text style={styles.authorText}>Autor: {item.author}</Text>
        <Text style={styles.dimensionsText}>
          Dimensiones: {item.width} x {item.height}
        </Text>
      </View>
    </View>
  );

  // 5. Mostrar un indicador de carga mientras se obtienen los datos
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text>Cargando galería...</Text>
      </View>
    );
  }

  // 6. Renderizar la galería
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      <Text style={styles.title}>Galería de Fotos Picsum</Text>
      <FlatList
        data={photos}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
      />
    </SafeAreaView>
  );
}

// 7. Estilos para un buen diseño
const windowWidth = Dimensions.get('window').width;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f4f8',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 20,
    color: '#333',
  },
  listContainer: {
    paddingHorizontal: 10,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 16,
    // Sombra para iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    // Sombra para Android
    elevation: 4,
    overflow: 'hidden', // Para que la imagen respete los bordes redondeados
  },
  image: {
    width: '100%',
    height: windowWidth * 0.6, // Alto de la imagen (60% del ancho de la pantalla)
  },
  infoContainer: {
    padding: 12,
  },
  authorText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
  },
  dimensionsText: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
});