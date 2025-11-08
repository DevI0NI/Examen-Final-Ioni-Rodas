const API_URL = 'https://picsum.photos/v2/list';

export const fetchPhotos = async () => {
  try {
    const response = await fetch(API_URL);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching photos from Picsum API: ", error);
    throw error; 
  }
};