<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PlanDefinition extends Model
{
    public const GLOBAL_KEY = '_global';

    protected $fillable = [
        'plan_key',
        'definition',
    ];

    protected $casts = [
        'definition' => 'array',
    ];
}
