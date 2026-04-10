<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SalesReport extends Model
{
    protected $fillable = [
        'order_id',
        'date',
        'total_sales',
        'total_profit',
        'total_cost',
        'items_count',
        'payment_method'
    ];
    
    protected $casts = [
        'date' => 'datetime',
        'total_sales' => 'float',
        'total_profit' => 'float',
        'total_cost' => 'float',
        'items_count' => 'integer'
    ];
    
    public function order()
    {
        return $this->belongsTo(Order::class);
    }
}