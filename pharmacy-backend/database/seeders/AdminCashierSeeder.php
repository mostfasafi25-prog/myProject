<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminCashierSeeder extends Seeder
{
    public function run(): void
    {
        User::updateOrCreate(
            ['username' => 'admin'],
            [
                'password' => Hash::make('Admin@12345'),
                'role' => 'admin',
                'approval_status' => 'approved',
            ]
        );

        User::updateOrCreate(
            ['username' => 'cashier'],
            [
                'password' => Hash::make('Cashier@12345'),
                'role' => 'cashier',
                'approval_status' => 'approved',
            ]
        );

        User::updateOrCreate(
            ['username' => 'cashier_special'],
            [
                'password' => Hash::make('Cashier@12345'),
                'role' => 'super_cashier',
                'approval_status' => 'approved',
            ]
        );
    }
}
