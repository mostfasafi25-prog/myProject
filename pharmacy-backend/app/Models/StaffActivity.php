<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StaffActivity extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'username',
        'role',
        'action_type',
        'entity_type',
        'entity_id',
        'description',
        'meta',
    ];

    protected $casts = [
        'meta' => 'array',
    ];
}
