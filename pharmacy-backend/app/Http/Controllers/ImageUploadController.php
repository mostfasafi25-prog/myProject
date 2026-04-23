<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\File;

class ImageUploadController extends Controller
{
    private string $publicImageDir = 'uploads/products/images';
    private string $publicThumbDir = 'uploads/products/images/thumbnails';

    /**
     * Upload image for products
     */
    public function uploadProductImage(Request $request)
    {
        try {
            // التحقق من وجود الملف
            if (!$request->hasFile('image')) {
                return response()->json([
                    'success' => false,
                    'message' => 'لم يتم إرسال أي ملف'
                ], 400);
            }
            
            $image = $request->file('image');
            
            // التحقق من صحة الملف
            if (!$image->isValid()) {
                return response()->json([
                    'success' => false,
                    'message' => 'الملف غير صالح'
                ], 400);
            }
            
            // التحقق من نوع الملف
            $mime = $image->getClientMimeType();
            $allowed = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp'];
            if (!in_array($mime, $allowed)) {
                return response()->json([
                    'success' => false,
                    'message' => 'نوع الملف غير مدعوم'
                ], 400);
            }
            
            // إنشاء اسم فريد
            $extension = $image->getClientOriginalExtension();
            $filename = 'product_' . time() . '_' . Str::random(10) . '.' . $extension;
            
            // إنشاء المجلدات
            $this->ensurePublicImageDirs();
            
            // نقل الملف مباشرة
            $destinationPath = public_path($this->publicImageDir);
            $image->move($destinationPath, $filename);
            
            // الحصول على حجم الملف بعد النقل
            $fullPath = $destinationPath . DIRECTORY_SEPARATOR . $filename;
            $fileSize = File::exists($fullPath) ? File::size($fullPath) : 0;
            
            // إنشاء الصورة المصغرة
            $thumbnailFilename = 'thumb_' . $filename;
            $thumbnailPath = public_path($this->publicThumbDir . DIRECTORY_SEPARATOR . $thumbnailFilename);
            $this->storeThumbnail($fullPath, $thumbnailPath, $extension);
            
            // إنشاء الروابط
            $imageUrl = '/' . trim(str_replace(DIRECTORY_SEPARATOR, '/', $this->publicImageDir), '/') . '/' . $filename;
            $thumbnailUrl = '/' . trim(str_replace(DIRECTORY_SEPARATOR, '/', $this->publicThumbDir), '/') . '/' . $thumbnailFilename;
            
            return response()->json([
                'success' => true,
                'message' => 'تم رفع الصورة بنجاح',
                'image_url' => $imageUrl,
                'data' => [
                    'image_url' => $imageUrl,
                    'thumbnail_url' => $thumbnailUrl,
                    'filename' => $filename,
                    'size' => $fileSize,
                    'mime_type' => $mime
                ]
            ]);
            
        } catch (\Exception $e) {
            \Log::error('Image upload error: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ أثناء رفع الصورة: ' . $e->getMessage()
            ], 500);
        }
    }
    
    /**
     * Upload multiple images
     */
    public function uploadMultipleImages(Request $request)
    {
        try {
            if (!$request->hasFile('images')) {
                return response()->json([
                    'success' => false,
                    'message' => 'لم يتم إرسال أي صور'
                ], 400);
            }
            
            $uploadedImages = [];
            $images = $request->file('images');
            $this->ensurePublicImageDirs();
            
            foreach ($images as $index => $image) {
                if (!$image->isValid()) continue;
                
                $extension = $image->getClientOriginalExtension();
                $filename = 'product_' . time() . '_' . $index . '_' . Str::random(10) . '.' . $extension;
                
                $destinationPath = public_path($this->publicImageDir);
                $image->move($destinationPath, $filename);
                
                $fullPath = $destinationPath . DIRECTORY_SEPARATOR . $filename;
                $fileSize = File::exists($fullPath) ? File::size($fullPath) : 0;
                
                $thumbnailFilename = 'thumb_' . $filename;
                $thumbnailPath = public_path($this->publicThumbDir . DIRECTORY_SEPARATOR . $thumbnailFilename);
                $this->storeThumbnail($fullPath, $thumbnailPath, $extension);
                
                $uploadedImages[] = [
                    'image_url' => '/' . trim(str_replace(DIRECTORY_SEPARATOR, '/', $this->publicImageDir), '/') . '/' . $filename,
                    'thumbnail_url' => '/' . trim(str_replace(DIRECTORY_SEPARATOR, '/', $this->publicThumbDir), '/') . '/' . $thumbnailFilename,
                    'filename' => $filename,
                    'size' => $fileSize,
                    'mime_type' => $image->getClientMimeType()
                ];
            }
            
            return response()->json([
                'success' => true,
                'message' => 'تم رفع الصور بنجاح',
                'data' => [
                    'images' => $uploadedImages,
                    'total_uploaded' => count($uploadedImages)
                ]
            ]);
            
        } catch (\Exception $e) {
            \Log::error('Multiple images upload error: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ أثناء رفع الصور: ' . $e->getMessage()
            ], 500);
        }
    }
    
    /**
     * Delete image
     */
    public function deleteImage(Request $request)
    {
        try {
            $imageUrl = $request->input('image_url');
            if (!$imageUrl) {
                return response()->json([
                    'success' => false,
                    'message' => 'رابط الصورة مطلوب'
                ], 422);
            }
            
            $filename = basename($imageUrl);
            $imagePath = public_path($this->publicImageDir . DIRECTORY_SEPARATOR . $filename);
            $thumbnailPath = public_path($this->publicThumbDir . DIRECTORY_SEPARATOR . 'thumb_' . $filename);
            
            if (File::exists($imagePath)) {
                File::delete($imagePath);
            }
            if (File::exists($thumbnailPath)) {
                File::delete($thumbnailPath);
            }
            
            return response()->json([
                'success' => true,
                'message' => 'تم حذف الصورة بنجاح'
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ أثناء حذف الصورة: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * حفظ نسخة مصغرة
     */
    private function storeThumbnail(string $sourcePath, string $thumbnailPath, string $extension): void
    {
        if (!File::exists($sourcePath)) {
            return;
        }
        
        $raw = File::get($sourcePath);
        if ($raw === false) {
            return;
        }
        
        if (!function_exists('imagecreatefromstring')) {
            File::put($thumbnailPath, $raw);
            return;
        }

        $src = @imagecreatefromstring($raw);
        if (!$src) {
            File::put($thumbnailPath, $raw);
            return;
        }

        $srcW = imagesx($src);
        $srcH = imagesy($src);
        if ($srcW < 1 || $srcH < 1) {
            imagedestroy($src);
            File::put($thumbnailPath, $raw);
            return;
        }

        $max = 300;
        $scale = min($max / $srcW, $max / $srcH, 1);
        $newW = max(1, (int) round($srcW * $scale));
        $newH = max(1, (int) round($srcH * $scale));

        $thumb = imagecreatetruecolor($newW, $newH);
        imagealphablending($thumb, false);
        imagesavealpha($thumb, true);
        $transparent = imagecolorallocatealpha($thumb, 0, 0, 0, 127);
        imagefilledrectangle($thumb, 0, 0, $newW, $newH, $transparent);
        imagecopyresampled($thumb, $src, 0, 0, 0, 0, $newW, $newH, $srcW, $srcH);

        ob_start();
        $ext = strtolower($extension);
        if ($ext === 'png') {
            imagepng($thumb, null, 6);
        } elseif ($ext === 'gif') {
            imagegif($thumb);
        } elseif ($ext === 'webp' && function_exists('imagewebp')) {
            imagewebp($thumb, null, 90);
        } else {
            imagejpeg($thumb, null, 90);
        }
        $binary = ob_get_clean();

        imagedestroy($thumb);
        imagedestroy($src);

        if (is_string($binary) && $binary !== '') {
            File::put($thumbnailPath, $binary);
        } else {
            File::put($thumbnailPath, $raw);
        }
    }

    private function ensurePublicImageDirs(): void
    {
        $imgDir = public_path($this->publicImageDir);
        $thumbDir = public_path($this->publicThumbDir);
        
        if (!File::isDirectory($imgDir)) {
            File::makeDirectory($imgDir, 0755, true);
        }
        if (!File::isDirectory($thumbDir)) {
            File::makeDirectory($thumbDir, 0755, true);
        }
    }
}