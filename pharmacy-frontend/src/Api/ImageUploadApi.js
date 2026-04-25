import { Axios } from "./Axios";

/**
 * Upload single product image
 * @param {File} imageFile - The image file to upload
 * @returns {Promise} API response
 */
export const uploadProductImage = async (imageFile) => {
  const formData = new FormData();
  formData.append('image', imageFile);
  
  try {
    const response = await Axios.post('upload/product-image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error uploading product image:', error);
    throw error;
  }
};

/**
 * Upload multiple product images
 * @param {File[]} imageFiles - Array of image files to upload
 * @returns {Promise} API response
 */
export const uploadMultipleImages = async (imageFiles) => {
  const formData = new FormData();
  
  imageFiles.forEach((file, index) => {
    formData.append(`images[${index}]`, file);
  });
  
  try {
    const response = await Axios.post('upload/multiple-images', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error uploading multiple images:', error);
    throw error;
  }
};

/**
 * Delete an image
 * @param {string} imageUrl - The URL of the image to delete
 * @returns {Promise} API response
 */
export const deleteImage = async (imageUrl) => {
  try {
    const response = await Axios.delete('upload/delete-image', {
      data: { image_url: imageUrl }
    });
    return response.data;
  } catch (error) {
    console.error('Error deleting image:', error);
    throw error;
  }
};

/**
 * Validate image file before upload
 * @param {File} file - The file to validate
 * @returns {Object} Validation result
 */
export const validateImageFile = (file) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  const maxSize = 2 * 1024 * 1024; // 2MB
  
  const result = {
    isValid: true,
    errors: []
  };
  
  if (!allowedTypes.includes(file.type)) {
    result.isValid = false;
    result.errors.push('يجب أن تكون الصورة من نوع: jpeg, png, jpg, gif, webp');
  }
  
  if (file.size > maxSize) {
    result.isValid = false;
    result.errors.push('حجم الصورة يجب ألا يتجاوز 2 ميجابايت');
  }
  
  return result;
};

/**
 * Create image preview URL
 * @param {File} file - The image file
 * @returns {string} Preview URL
 */
export const createImagePreview = (file) => {
  return URL.createObjectURL(file);
};

/**
 * Revoke image preview URL
 * @param {string} url - The preview URL to revoke
 */
export const revokeImagePreview = (url) => {
  URL.revokeObjectURL(url);
};
