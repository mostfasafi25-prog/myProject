<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Supplier extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name',
        'phone',
        'email',
        'address',
        'tax_number',
        'balance',
        'notes',
        'is_active'
    ];

    protected $casts = [
        'balance' => 'decimal:2',
        'is_active' => 'boolean'
    ];

    /**
     * علاقة المورد مع المشتريات
     */
    public function purchases()
    {
        return $this->hasMany(Purchase::class);
    }

    /**
     * علاقة المورد مع المنتجات
     */
    public function products()
    {
        return $this->hasMany(Product::class);
    }

    /**
     * نطاق الموردين النشطين
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * نطاق الموردين المدينين
     */
    public function scopeWithBalance($query)
    {
        return $query->where('balance', '>', 0);
    }
}