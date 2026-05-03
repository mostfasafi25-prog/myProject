<?php

namespace App\Support;

use App\Models\Pharmacy;

final class BackendWebScope
{
    public const SESSION_KEY = 'backend_pharmacy_scope_id';

    public static function id(): ?int
    {
        $v = session(self::SESSION_KEY);
        if ($v === null || $v === '') {
            return null;
        }

        return (int) $v;
    }

    public static function set(int $pharmacyId): void
    {
        session([self::SESSION_KEY => $pharmacyId]);
    }

    public static function clear(): void
    {
        session()->forget(self::SESSION_KEY);
    }

    public static function pharmacy(): ?Pharmacy
    {
        $id = self::id();
        if ($id === null || $id < 1) {
            return null;
        }

        return Pharmacy::find($id);
    }

    public static function active(): bool
    {
        return self::id() !== null && self::id() > 0 && self::pharmacy() !== null;
    }
}
