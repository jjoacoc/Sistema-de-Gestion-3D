<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Movimiento extends Model
{
    protected $fillable = [
        'producto_id',
        'user_id',
        'tipo',
        'cantidad',
        'stock_resultante',
        'motivo',
    ];

    // Un movimiento pertenece a una prenda
    public function producto(): BelongsTo
    {
        return $this->belongsTo(Producto::class);
    }

    // ...y lo hizo un usuario (la clave es user_id, por eso se indica)
    public function usuario(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}