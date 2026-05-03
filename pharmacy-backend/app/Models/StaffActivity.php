<?php

namespace App\Models;

use App\Models\Concerns\BelongsToPharmacy;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StaffActivity extends Model
{
    use BelongsToPharmacy;
    use HasFactory;

    protected $fillable = [
        'pharmacy_id',
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
