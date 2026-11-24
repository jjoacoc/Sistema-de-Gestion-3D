<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class UserSeeder extends Seeder
{
    // Un usuario por rol, para poder probar y mostrar en la defensa.
    // La contraseña se encripta sola (el modelo User la guarda con hash).
    public function run(): void
    {
        User::create([
            'name'     => 'Joaquin Cofre',
            'email'    => 'admin@almacen.test',
            'password' => 'password',
            'rol'      => User::ROL_ADMINISTRADOR,
        ]);

        User::create([
            'name'     => 'Jhonn Volkov',
            'email'    => 'operario@almacen.test',
            'password' => 'password',
            'rol'      => User::ROL_OPERARIO,
        ]);
    }
}