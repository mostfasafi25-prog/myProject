<?php

namespace App\Models\Concerns;

use App\Models\Pharmacy;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Auth;

trait BelongsToPharmacy
{
    protected static function bootBelongsToPharmacy(): void
    {
        static::addGlobalScope('pharmacy', function (Builder $builder) {
            $user = Auth::user();
            if (!$user || $user->pharmacy_id === null) {
                return;
            }
            $table = $builder->getModel()->getTable();
            $builder->where($table.'.pharmacy_id', $user->pharmacy_id);
        });

        static::creating(function ($model) {
            if (!Auth::check()) {
                return;
            }
            $user = Auth::user();
            $pid = $model->getAttribute('pharmacy_id');
            if ($pid !== null && $pid !== '') {
                return;
            }
            if ($user->pharmacy_id !== null) {
                $model->setAttribute('pharmacy_id', $user->pharmacy_id);

                return;
            }
            if ($model instanceof User && (string) ($model->role ?? '') === 'super_admin') {
                $model->setAttribute('pharmacy_id', null);

                return;
            }
            $model->setAttribute('pharmacy_id', (int) config('pharmacy.default_pharmacy_id', 1));
        });
    }

    public function pharmacy()
    {
        return $this->belongsTo(Pharmacy::class);
    }
}
