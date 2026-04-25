import React, { useState, useRef } from 'react';
import {
  Box,
  Button,
  IconButton,
  Typography,
  CircularProgress,
  Alert,
  ImageList,
  ImageListItem,
  ImageListItemBar,
  Dialog,
  DialogContent,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Delete as DeleteIcon,
  ZoomIn as ZoomInIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { uploadProductImage, uploadMultipleImages, deleteImage, validateImageFile, createImagePreview, revokeImagePreview } from '../Api/ImageUploadApi';

const ImageUpload = ({
  multiple = false,
  maxImages = 5,
  onImagesChange,
  initialImages = [],
  disabled = false,
  accept = 'image/jpeg,image/jpg,image/png,image/gif,image/webp',
}) => {
  const [images, setImages] = useState(initialImages);
  const [previews, setPreviews] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [previewDialog, setPreviewDialog] = useState({ open: false, image: null });
  const fileInputRef = useRef(null);

  const handleFileSelect = async (event) => {
    const files = Array.from(event.target.files);
    
    if (files.length === 0) return;
    
    // Validate files
    const validationErrors = [];
    const validFiles = [];
    
    files.forEach((file, index) => {
      const validation = validateImageFile(file);
      if (!validation.isValid) {
        validationErrors.push(`الصورة ${index + 1}: ${validation.errors.join(', ')}`);
      } else {
        validFiles.push(file);
      }
    });
    
    if (validationErrors.length > 0) {
      setError(validationErrors.join('\n'));
      return;
    }
    
    // Check max images limit
    if (multiple && images.length + validFiles.length > maxImages) {
      setError(`لا يمكن رفع أكثر من ${maxImages} صور`);
      return;
    }
    
    if (!multiple && validFiles.length > 1) {
      setError('يمكن رفع صورة واحدة فقط');
      return;
    }
    
    setError('');
    setUploading(true);
    
    try {
      let uploadResult;
      
      if (multiple) {
        uploadResult = await uploadMultipleImages(validFiles);
      } else {
        uploadResult = await uploadProductImage(validFiles[0]);
      }
      
      if (uploadResult.success) {
        const newImages = multiple ? uploadResult.data.images : [uploadResult.data];
        const updatedImages = [...images, ...newImages];
        
        setImages(updatedImages);
        
        // Create previews for new images
        const newPreviews = validFiles.map(file => createImagePreview(file));
        setPreviews([...previews, ...newPreviews]);
        
        // Notify parent component
        if (onImagesChange) {
          onImagesChange(updatedImages);
        }
      } else {
        setError(uploadResult.message || 'فشل رفع الصور');
      }
    } catch (err) {
      setError('حدث خطأ أثناء رفع الصور');
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteImage = async (index, imageUrl) => {
    try {
      await deleteImage(imageUrl);
      
      const updatedImages = images.filter((_, i) => i !== index);
      setImages(updatedImages);
      
      // Revoke preview if exists
      if (previews[index]) {
        revokeImagePreview(previews[index]);
        const updatedPreviews = previews.filter((_, i) => i !== index);
        setPreviews(updatedPreviews);
      }
      
      // Notify parent component
      if (onImagesChange) {
        onImagesChange(updatedImages);
      }
    } catch (err) {
      setError('فشل حذف الصورة');
      console.error('Delete error:', err);
    }
  };

  const handlePreviewOpen = (image) => {
    setPreviewDialog({ open: true, image });
  };

  const handlePreviewClose = () => {
    setPreviewDialog({ open: false, image: null });
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <Box sx={{ width: '100%' }}>
      {/* Upload Button */}
      <Box sx={{ mb: 2 }}>
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileSelect}
          style={{ display: 'none' }}
          disabled={disabled || uploading}
        />
        
        <Button
          variant="outlined"
          startIcon={uploading ? <CircularProgress size={20} /> : <UploadIcon />}
          onClick={handleUploadClick}
          disabled={disabled || uploading}
          fullWidth
          sx={{ py: 2 }}
        >
          {uploading ? 'جاري الرفع...' : `اختر صور${multiple ? 'ة أو أكثر' : 'ة'}`}
        </Button>
      </Box>

      {/* Error Message */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Images Display */}
      {images.length > 0 && (
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            الصور المرفوعة ({images.length}/{multiple ? maxImages : 1})
          </Typography>
          
          <ImageList cols={multiple ? 3 : 1} gap={8}>
            {images.map((image, index) => (
              <ImageListItem key={index} sx={{ position: 'relative' }}>
                <img
                  src={image.image_url || image}
                  alt={`صورة ${index + 1}`}
                  loading="lazy"
                  style={{
                    width: '100%',
                    height: 200,
                    objectFit: 'cover',
                    borderRadius: 1,
                    cursor: 'pointer',
                  }}
                  onClick={() => handlePreviewOpen(image)}
                />
                
                <ImageListItemBar
                  sx={{
                    background: 'rgba(0, 0, 0, 0.5)',
                    borderRadius: '0 0 8px 8px',
                  }}
                  position="bottom"
                  actionIcon={
                    <IconButton
                      size="small"
                      onClick={() => handleDeleteImage(index, image.image_url || image)}
                      sx={{ color: 'white' }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  }
                  actionPosition="right"
                />
              </ImageListItem>
            ))}
          </ImageList>
        </Box>
      )}

      {/* Preview Dialog */}
      <Dialog
        open={previewDialog.open}
        onClose={handlePreviewClose}
        maxWidth="md"
        fullWidth
      >
        <DialogContent sx={{ p: 1, position: 'relative' }}>
          <IconButton
            onClick={handlePreviewClose}
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              zIndex: 1,
              bgcolor: 'rgba(0, 0, 0, 0.5)',
              color: 'white',
              '&:hover': {
                bgcolor: 'rgba(0, 0, 0, 0.7)',
              },
            }}
          >
            <CloseIcon />
          </IconButton>
          
          {previewDialog.image && (
            <img
              src={previewDialog.image.image_url || previewDialog.image}
              alt="معاينة الصورة"
              style={{
                width: '100%',
                height: 'auto',
                maxHeight: '70vh',
                objectFit: 'contain',
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default ImageUpload;
