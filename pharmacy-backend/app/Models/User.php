<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, Notifiable;

    // الأدوار المسموحة
    const ROLE_ADMIN = 'admin';
    const ROLE_CASHIER = 'cashier';
    
    protected $fillable = [
        'username',
        'password',
        'avatar_url',
        'role', // أضف role هنا
        'approval_status',
        'is_active',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    // دالة للتحقق إذا المستخدم admin
    public function isAdmin()
    {
        return $this->role === self::ROLE_ADMIN;
    }

    // دالة للتحقق إذا المستخدم كاشير
    public function isCashier()
    {
        return $this->role === self::ROLE_CASHIER;
    }
}