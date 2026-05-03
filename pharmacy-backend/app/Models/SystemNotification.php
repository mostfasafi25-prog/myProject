<?php

namespace App\Models;

use App\Models\Concerns\BelongsToPharmacy;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SystemNotification extends Model
{
    use BelongsToPharmacy;
    use HasFactory;

    protected $fillable = [
        'pharmacy_id',
        'type',
        'pref_category',
        'title',
        'message',
        'details',
        'from_management',
        'management_label',
        'recipients_type',
        'recipient_usernames',
        'read_by',
        'deleted_by',
        'meta',
        'created_by',
    ];

    protected $casts = [
        'from_management' => 'boolean',
        'recipient_usernames' => 'array',
        'read_by' => 'array',
        'deleted_by' => 'array',
        'meta' => 'array',
    ];
}
