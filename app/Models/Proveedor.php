<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Proveedor extends Model
{
    // Laravel pluralizaría "Proveedor" como "proveedors": se le indica el nombre real
    protected $table = 'proveedores';

    protected $fillable = ['nombre', 'email', 'telefono'];

    // Un proveedor surte muchos productos (N:M)
    public function productos(): BelongsToMany
    {
        return $this->belongsToMany(Producto::class, 'producto_proveedor')
            ->withPivot('precio_costo', 'codigo_proveedor')
            ->withTimestamps();
    }
}