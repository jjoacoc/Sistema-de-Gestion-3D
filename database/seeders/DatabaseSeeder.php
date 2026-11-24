<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // El orden importa: primero los estantes, porque los productos dependen de ellos
        $this->call([
            UserSeeder::class,
            EstanteSeeder::class,
            ProductoSeeder::class,
            ProveedorSeeder::class,
            MovimientoSeeder::class,
        ]);
    }
}