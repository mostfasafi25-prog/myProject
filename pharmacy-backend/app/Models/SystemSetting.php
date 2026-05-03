<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SystemSetting extends Model
{
    use HasFactory;

    protected $fillable = [
        'pharmacy_id',
        'key',
        'value_json',
    ];

    protected $casts = [
        'value_json' => 'array',
    ];
}

