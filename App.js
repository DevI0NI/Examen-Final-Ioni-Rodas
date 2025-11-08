// App.js
import React, { useEffect, useRef, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  ActivityIndicator,
  Dimensions,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Modal,
  Animated,
  StatusBar,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AntDesign, Feather, Ionicons } from '@expo/vector-icons';

const windowWidth = Dimensions.get('window').width;
const TWO_COL_WIDTH = (windowWidth - 32) / 2; // para grid

export default function App() {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // filtros y búsqueda
  const [search, setSearch] = useState('');
  const [sizeFilter, setSizeFilter] = useState('all'); // all | small | medium | large
  const [onlyFavoritesView, setOnlyFavoritesView] = useState(false);

  // modal / carrusel
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // favoritos y tema
  const [favorites, setFavorites] = useState({});
  const [themeDark, setThemeDark] = useState(true);

  // animación entrada
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // ref flatlist para scroll-to-top
  const listRef = useRef(null);
  const carouselRef = useRef(null);

  // --- Carga de fotos desde API ---
  const fetchPhotos = async () => {
    try {
      if (!refreshing) setLoading(true);
      // pido 40 para tener suficiente
      const res = await fetch('https://picsum.photos/v2/list?page=2&limit=40');
      const data = await res.json();
      setPhotos(data);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    } catch (err) {
      console.error('fetch error', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    (async () => {
      await loadFavoritesFromStorage();
      await fetchPhotos();
      // try to load theme saved (optional)
      try {
        const t = await AsyncStorage.getItem('@themeDark');
        if (t !== null) setThemeDark(t === '1');
      } catch {}
    })();
  }, []);

  // --- Favoritos en AsyncStorage ---
  const loadFavoritesFromStorage = async () => {
    try {
      const json = await AsyncStorage.getItem('@favorites_v1');
      if (json) setFavorites(JSON.parse(json));
    } catch (e) {
      console.warn('No se pudo leer favoritos', e);
    }
  };

  const saveFavoritesToStorage = async (next) => {
    try {
      await AsyncStorage.setItem('@favorites_v1', JSON.stringify(next));
    } catch (e) {
      console.warn('No se pudo guardar favoritos', e);
    }
  };

  const toggleFavorite = (photo) => {
    const next = { ...favorites };
    if (next[photo.id]) delete next[photo.id];
    else next[photo.id] = photo;
    setFavorites(next);
    saveFavoritesToStorage(next);
  };

  // --- Tema persistente ---
  const toggleTheme = async () => {
    const next = !themeDark;
    setThemeDark(next);
    try {
      await AsyncStorage.setItem('@themeDark', next ? '1' : '0');
    } catch {}
  };

  // --- Filtros / búsqueda ---
  const filterBySize = (p) => {
    const area = p.width * p.height;
    if (sizeFilter === 'small') return area < 200000; // heurístico
    if (sizeFilter === 'medium') return area >= 200000 && area < 600000;
    if (sizeFilter === 'large') return area >= 600000;
    return true;
  };

  const filteredPhotos = photos
    .filter((p) => {
      if (onlyFavoritesView) return !!favorites[p.id];
      return true;
    })
    .filter((p) => filterBySize(p))
    .filter((p) => {
      if (!search) return true;
      return p.author.toLowerCase().includes(search.toLowerCase());
    });

  // --- Pull to refresh ---
  const onRefresh = () => {
    setRefreshing(true);
    fetchPhotos();
  };

  // --- Modal handlers ---
  const openModalAt = (index) => {
    setSelectedIndex(index);
    setModalVisible(true);
    // small delay for modal open then scroll carousel to item
    setTimeout(() => {
      if (carouselRef.current) {
        carouselRef.current.scrollToIndex({ index, animated: false });
      }
    }, 50);
  };

  const closeModal = () => setModalVisible(false);

  const goTop = () => {
    if (listRef.current) listRef.current.scrollToOffset({ offset: 0, animated: true });
  };

  // UI colors según tema
  const colors = {
    background: themeDark ? '#0f1724' : '#f6f7fb',
    card: themeDark ? '#111827' : '#ffffff',
    text: themeDark ? '#e6eef8' : '#0b1220',
    subText: themeDark ? '#9aa4b2' : '#6b7280',
    accent: '#8A2BE2',
    danger: '#ff6b6b',
  };

  // --- Render de grid item ---
  const renderItem = ({ item, index }) => {
    const isFav = !!favorites[item.id];
    return (
      <Animated.View style={[styles.card, { backgroundColor: colors.card, opacity: fadeAnim }]}>
        <TouchableOpacity activeOpacity={0.9} onPress={() => openModalAt(index)}>
          <Image
            source={{ uri: `${item.download_url}?w=${Math.floor(TWO_COL_WIDTH)}&h=${Math.floor(TWO_COL_WIDTH * 0.75)}` }}
            style={styles.gridImage}
            resizeMode="cover"
          />
        </TouchableOpacity>
        <View style={styles.cardFooter}>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={[styles.authorText, { color: colors.text }]}>
              {item.author}
            </Text>
            <Text style={[styles.dimText, { color: colors.subText }]}>
              {item.width} x {item.height}
            </Text>
          </View>

          <TouchableOpacity onPress={() => toggleFavorite(item)} style={styles.iconBtn}>
            <AntDesign name={isFav ? 'heart' : 'hearto'} size={18} color={isFav ? colors.accent : colors.subText} />
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  };

  // --- Modal carrusel item ---
  const ModalItem = ({ item }) => {
    const scale = useRef(new Animated.Value(1)).current;

    const onPressIn = () => Animated.spring(scale, { toValue: 0.98, useNativeDriver: true }).start();
    const onPressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();

    return (
      <View style={styles.modalSlide}>
        <Animated.Image
          onStartShouldSetResponder={() => true}
          style={[styles.modalImage, { transform: [{ scale }] }]}
          source={{ uri: `${item.download_url}?w=${Math.floor(windowWidth)}&h=${Math.floor(windowWidth * 0.8)}` }}
          resizeMode="contain"
        />
        <View style={styles.modalMeta}>
          <Text style={[styles.modalAuthor, { color: colors.text }]}>{item.author}</Text>
          <Text style={[styles.modalDim, { color: colors.subText }]}>{item.width} x {item.height}</Text>
        </View>

        <View style={styles.modalActions}>
          <TouchableOpacity onPress={() => toggleFavorite(item)} style={styles.modalActionBtn}>
            <AntDesign name={favorites[item.id] ? 'heart' : 'hearto'} size={22} color={favorites[item.id] ? colors.accent : colors.subText} />
            <Text style={{ color: colors.subText, marginLeft: 8 }}>{favorites[item.id] ? 'Favorito' : 'Guardar'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // --- UI principal ---
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={themeDark ? 'light-content' : 'dark-content'} />
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>Galería Picsum</Text>
          <Text style={[styles.subtitle, { color: colors.subText }]}>
            {onlyFavoritesView ? 'Favoritos' : `Fotos: ${filteredPhotos.length}`}
          </Text>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerIcon} onPress={() => setOnlyFavoritesView(!onlyFavoritesView)}>
            <Feather name={onlyFavoritesView ? 'star' : 'star'} size={20} color={onlyFavoritesView ? colors.accent : colors.subText} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.headerIcon} onPress={toggleTheme}>
            <Ionicons name={themeDark ? 'sunny' : 'moon'} size={20} color={colors.subText} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Buscador + filtros */}
      <View style={[styles.controls, { backgroundColor: colors.card }]}>
        <View style={styles.searchRow}>
          <Feather name="search" size={18} color={colors.subText} style={{ marginRight: 8 }} />
          <TextInput
            placeholder="Buscar por autor..."
            placeholderTextColor={colors.subText}
            value={search}
            onChangeText={setSearch}
            style={[styles.searchInput, { color: colors.text }]}
          />
          <TouchableOpacity onPress={() => { setSearch(''); }}>
            <AntDesign name="closecircle" size={18} color={colors.subText} />
          </TouchableOpacity>
        </View>

        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterBtn, sizeFilter === 'all' && { borderColor: colors.accent }]}
            onPress={() => setSizeFilter('all')}
          >
            <Text style={{ color: colors.subText }}>Todos</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterBtn, sizeFilter === 'small' && { borderColor: colors.accent }]}
            onPress={() => setSizeFilter('small')}
          >
            <Text style={{ color: colors.subText }}>Pequeñas</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterBtn, sizeFilter === 'medium' && { borderColor: colors.accent }]}
            onPress={() => setSizeFilter('medium')}
          >
            <Text style={{ color: colors.subText }}>Medianas</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterBtn, sizeFilter === 'large' && { borderColor: colors.accent }]}
            onPress={() => setSizeFilter('large')}
          >
            <Text style={{ color: colors.subText }}>Grandes</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Lista / Grid */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={{ marginTop: 12, color: colors.subText }}>Cargando galería...</Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={filteredPhotos}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 120, paddingTop: 10 }}
          columnWrapperStyle={{ justifyContent: 'space-between' }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
          ListEmptyComponent={() => (
            <View style={{ marginTop: 40, alignItems: 'center' }}>
              <Text style={{ color: colors.subText }}>No hay resultados</Text>
            </View>
          )}
        />
      )}

      {/* FAB subir arriba */}
      <TouchableOpacity style={[styles.fab, { backgroundColor: colors.accent }]} onPress={goTop}>
        <AntDesign name="arrowup" size={22} color="#fff" />
      </TouchableOpacity>

      {/* Modal con carrusel */}
      <Modal visible={modalVisible} animationType="slide" transparent={false} onRequestClose={closeModal}>
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeModal} style={{ padding: 6 }}>
              <AntDesign name="close" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>

          <FlatList
            ref={carouselRef}
            data={onlyFavoritesView ? filteredPhotos : filteredPhotos}
            horizontal
            pagingEnabled
            initialScrollIndex={selectedIndex}
            getItemLayout={(_, index) => ({ length: windowWidth, offset: windowWidth * index, index })}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <ModalItem item={item} />}
            showsHorizontalScrollIndicator={false}
          />

          {/* indicador simple */}
          <View style={styles.modalFooter}>
            <Text style={{ color: colors.subText }}>
              Desliza ← → para ver más — {favorites ? Object.keys(favorites).length : 0} favoritos
            </Text>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// --- estilos ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingHorizontal: 14,
    paddingTop: Platform.OS === 'android' ? 10 : 4,
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    marginLeft: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  controls: {
    marginHorizontal: 12,
    marginBottom: 10,
    borderRadius: 12,
    padding: 10,
    // shadow
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
      },
      android: { elevation: 2 },
    }),
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    height: 36,
    fontSize: 14,
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  filterBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },

  card: {
    width: TWO_COL_WIDTH,
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  gridImage: {
    width: '100%',
    height: TWO_COL_WIDTH * 0.75,
  },
  cardFooter: {
    flexDirection: 'row',
    padding: 8,
    alignItems: 'center',
  },
  authorText: {
    fontSize: 13,
    fontWeight: '600',
  },
  dimText: {
    fontSize: 11,
    marginTop: 2,
  },
  iconBtn: {
    padding: 6,
    marginLeft: 6,
  },

  fab: {
    position: 'absolute',
    right: 18,
    bottom: 26,
    width: 52,
    height: 52,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },

  // modal
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'flex-start',
  },
  modalSlide: {
    width: windowWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 12,
  },
  modalImage: {
    width: windowWidth,
    height: windowWidth * 0.8,
  },
  modalMeta: {
    marginTop: 10,
    alignItems: 'center',
  },
  modalAuthor: {
    fontSize: 16,
    fontWeight: '700',
  },
  modalDim: {
    fontSize: 13,
    marginTop: 6,
  },
  modalActions: {
    marginTop: 14,
    alignItems: 'center',
  },
  modalActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  modalFooter: {
    padding: 12,
    alignItems: 'center',
  },
});
