<?php

namespace App\Models;

use App\Models\Concerns\BelongsToPharmacy;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CashierShiftClose extends Model
{
    use BelongsToPharmacy;

    protected $fillable = [
        'pharmacy_id',
        'user_id',
        'username',
        'display_name',
        'client_row_id',
        'shift_started_at',
        'shift_ended_at',
        'invoice_count',
        'total',
        'cash',
        'app',
        'credit',
        'invoices_json',
    ];

    protected $casts = [
        'shift_started_at' => 'datetime',
        'shift_ended_at' => 'datetime',
        'invoice_count' => 'integer',
        'total' => 'decimal:2',
        'cash' => 'decimal:2',
        'app' => 'decimal:2',
        'credit' => 'decimal:2',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
