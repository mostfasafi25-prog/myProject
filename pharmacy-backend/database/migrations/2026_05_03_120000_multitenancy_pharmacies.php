<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('pharmacies')) {
            Schema::create('pharmacies', function (Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->timestamps();
            });
        }

        if (DB::table('pharmacies')->count() === 0) {
            DB::table('pharmacies')->insert([
                'id' => 1,
                'name' => 'الصيدلية الافتراضية',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $tenantTables = [
            'users',
            'categories',
            'products',
            'orders',
            'order_items',
            'customers',
            'suppliers',
            'purchases',
            'purchase_items',
            'purchase_returns',
            'treasury',
            'treasury_transactions',
            'cashier_shift_closes',
            'system_settings',
            'system_notifications',
            'staff_activities',
            'customer_credit_movements',
        ];

        foreach ($tenantTables as $table) {
            if (!Schema::hasTable($table)) {
                continue;
            }
            if (!Schema::hasColumn($table, 'pharmacy_id')) {
                Schema::table($table, function (Blueprint $blueprint) {
                    $blueprint->unsignedBigInteger('pharmacy_id')->nullable()->after('id');
                });
            }
        }

        foreach ($tenantTables as $table) {
            if (!Schema::hasTable($table) || !Schema::hasColumn($table, 'pharmacy_id')) {
                continue;
            }
            DB::table($table)->whereNull('pharmacy_id')->update(['pharmacy_id' => 1]);
        }

        if (Schema::hasTable('users')) {
            DB::table('users')->where('role', 'super_admin')->update(['pharmacy_id' => null]);
        }

        $this->backfillChildPharmacyIds();

        $this->swapCompositeUniques();

        foreach ($tenantTables as $table) {
            if (!Schema::hasTable($table) || !Schema::hasColumn($table, 'pharmacy_id')) {
                continue;
            }
            if ($table === 'users') {
                continue;
            }
            Schema::table($table, function (Blueprint $blueprint) {
                $blueprint->unsignedBigInteger('pharmacy_id')->nullable(false)->change();
            });
        }

        foreach ($tenantTables as $table) {
            if (!Schema::hasTable($table) || !Schema::hasColumn($table, 'pharmacy_id')) {
                continue;
            }
            $exists = DB::selectOne(
                'SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_TYPE = ? AND CONSTRAINT_NAME = ?',
                [$table, 'FOREIGN KEY', $table.'_pharmacy_id_foreign']
            );
            if ($exists) {
                continue;
            }
            Schema::table($table, function (Blueprint $blueprint) use ($table) {
                if ($table === 'users') {
                    $blueprint->foreign('pharmacy_id')->references('id')->on('pharmacies')->nullOnDelete();
                } else {
                    $blueprint->foreign('pharmacy_id')->references('id')->on('pharmacies')->cascadeOnDelete();
                }
            });
        }
    }

    private function backfillChildPharmacyIds(): void
    {
        if (Schema::hasTable('order_items') && Schema::hasColumn('order_items', 'pharmacy_id')
            && Schema::hasTable('orders') && Schema::hasColumn('orders', 'pharmacy_id')) {
            foreach (DB::table('order_items')->cursor() as $row) {
                $pid = DB::table('orders')->where('id', $row->order_id)->value('pharmacy_id');
                if ($pid !== null) {
                    DB::table('order_items')->where('id', $row->id)->update(['pharmacy_id' => $pid]);
                }
            }
        }

        if (Schema::hasTable('purchase_items') && Schema::hasColumn('purchase_items', 'pharmacy_id')
            && Schema::hasTable('purchases') && Schema::hasColumn('purchases', 'pharmacy_id')) {
            foreach (DB::table('purchase_items')->cursor() as $row) {
                $pid = DB::table('purchases')->where('id', $row->purchase_id)->value('pharmacy_id');
                if ($pid !== null) {
                    DB::table('purchase_items')->where('id', $row->id)->update(['pharmacy_id' => $pid]);
                }
            }
        }

        if (Schema::hasTable('treasury_transactions') && Schema::hasColumn('treasury_transactions', 'pharmacy_id')
            && Schema::hasTable('treasury') && Schema::hasColumn('treasury', 'pharmacy_id')) {
            foreach (DB::table('treasury_transactions')->cursor() as $row) {
                if (!$row->treasury_id) {
                    continue;
                }
                $pid = DB::table('treasury')->where('id', $row->treasury_id)->value('pharmacy_id');
                if ($pid !== null) {
                    DB::table('treasury_transactions')->where('id', $row->id)->update(['pharmacy_id' => $pid]);
                }
            }
        }
    }

    private function tryDropUnique(string $table, array $columns): void
    {
        try {
            Schema::table($table, function (Blueprint $blueprint) use ($columns) {
                $blueprint->dropUnique($columns);
            });
        } catch (\Throwable) {
            // قد يكون الاسم مختلفاً أو مُزالاً مسبقاً
        }
    }

    private function swapCompositeUniques(): void
    {
        if (Schema::hasTable('products') && Schema::hasColumn('products', 'pharmacy_id')) {
            $this->tryDropUnique('products', ['code']);
            $this->tryDropUnique('products', ['sku']);
            $this->tryDropUnique('products', ['barcode']);
            Schema::table('products', function (Blueprint $table) {
                if (!$this->indexExists('products', 'products_pharmacy_code_unique')) {
                    $table->unique(['pharmacy_id', 'code'], 'products_pharmacy_code_unique');
                }
                if (!$this->indexExists('products', 'products_pharmacy_sku_unique')) {
                    $table->unique(['pharmacy_id', 'sku'], 'products_pharmacy_sku_unique');
                }
                if (!$this->indexExists('products', 'products_pharmacy_barcode_unique')) {
                    $table->unique(['pharmacy_id', 'barcode'], 'products_pharmacy_barcode_unique');
                }
            });
        }

        if (Schema::hasTable('categories') && Schema::hasColumn('categories', 'pharmacy_id')) {
            $this->tryDropUnique('categories', ['slug']);
            Schema::table('categories', function (Blueprint $table) {
                if (!$this->indexExists('categories', 'categories_pharmacy_slug_unique')) {
                    $table->unique(['pharmacy_id', 'slug'], 'categories_pharmacy_slug_unique');
                }
            });
        }

        if (Schema::hasTable('orders') && Schema::hasColumn('orders', 'pharmacy_id')) {
            $this->tryDropUnique('orders', ['order_number']);
            Schema::table('orders', function (Blueprint $table) {
                if (!$this->indexExists('orders', 'orders_pharmacy_order_number_unique')) {
                    $table->unique(['pharmacy_id', 'order_number'], 'orders_pharmacy_order_number_unique');
                }
            });
        }

        if (Schema::hasTable('purchases') && Schema::hasColumn('purchases', 'pharmacy_id')) {
            $this->tryDropUnique('purchases', ['invoice_number']);
            Schema::table('purchases', function (Blueprint $table) {
                if (!$this->indexExists('purchases', 'purchases_pharmacy_invoice_unique')) {
                    $table->unique(['pharmacy_id', 'invoice_number'], 'purchases_pharmacy_invoice_unique');
                }
            });
        }

        if (Schema::hasTable('system_settings') && Schema::hasColumn('system_settings', 'pharmacy_id')) {
            $this->tryDropUnique('system_settings', ['key']);
            Schema::table('system_settings', function (Blueprint $table) {
                if (!$this->indexExists('system_settings', 'system_settings_pharmacy_key_unique')) {
                    $table->unique(['pharmacy_id', 'key'], 'system_settings_pharmacy_key_unique');
                }
            });
        }

        if (Schema::hasTable('cashier_shift_closes') && Schema::hasColumn('cashier_shift_closes', 'pharmacy_id')) {
            $this->tryDropUnique('cashier_shift_closes', ['client_row_id']);
            Schema::table('cashier_shift_closes', function (Blueprint $table) {
                if (!$this->indexExists('cashier_shift_closes', 'cashier_shifts_pharmacy_client_row_unique')) {
                    $table->unique(['pharmacy_id', 'client_row_id'], 'cashier_shifts_pharmacy_client_row_unique');
                }
            });
        }

        if (Schema::hasTable('treasury_transactions') && Schema::hasColumn('treasury_transactions', 'pharmacy_id')) {
            $this->tryDropUnique('treasury_transactions', ['transaction_number']);
            Schema::table('treasury_transactions', function (Blueprint $table) {
                if (!$this->indexExists('treasury_transactions', 'treasury_tx_pharmacy_txn_unique')) {
                    $table->unique(['pharmacy_id', 'transaction_number'], 'treasury_tx_pharmacy_txn_unique');
                }
            });
        }
    }

    private function indexExists(string $table, string $indexName): bool
    {
        try {
            $row = DB::selectOne(
                'SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1',
                [$table, $indexName]
            );

            return $row !== null;
        } catch (\Throwable) {
            return false;
        }
    }

    public function down(): void
    {
    }
};
