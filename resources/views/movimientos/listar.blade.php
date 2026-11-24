@extends('layouts.principal')

@section('titulo', 'Movimientos')

@section('contenido')
    <h1 class="text-2xl font-bold mb-1">Movimientos de stock</h1>
    <p class="text-gray-600 mb-4">Historial de entradas y salidas, con la persona que las registró.</p>

    {{-- Filtros (se envían por GET, así quedan en la dirección y se pueden compartir) --}}
    <form method="GET" action="{{ route('movimientos.listar') }}" class="flex flex-wrap gap-2 mb-4">
        <input type="text" name="buscar" value="{{ $buscar }}" placeholder="Buscar por nombre o código..."
            class="flex-1 min-w-52 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">

        <select name="tipo" class="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
            <option value="">Todos los tipos</option>
            <option value="entrada" @selected($tipo === 'entrada')>Entradas</option>
            <option value="salida" @selected($tipo === 'salida')>Salidas</option>
        </select>

        <button type="submit" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm">Filtrar</button>
        <a href="{{ route('movimientos.listar') }}"
            class="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Limpiar</a>
    </form>

    <div class="bg-white rounded-xl shadow overflow-x-auto">
        <table class="w-full text-sm">
            <thead class="bg-gray-50 text-left text-gray-600">
                <tr>
                    <th class="px-4 py-3">Fecha</th>
                    <th class="px-4 py-3">Prenda</th>
                    <th class="px-4 py-3">Tipo</th>
                    <th class="px-4 py-3 text-right">Cantidad</th>
                    <th class="px-4 py-3 text-right">Stock resultante</th>
                    <th class="px-4 py-3">Usuario</th>
                </tr>
            </thead>
            <tbody>
                @forelse ($movimientos as $movimiento)
                    <tr class="border-t border-gray-100">
                        <td class="px-4 py-3 whitespace-nowrap">{{ $movimiento->created_at->format('d/m/Y H:i') }}</td>
                        <td class="px-4 py-3">
                            <span class="font-medium">{{ $movimiento->producto->nombre }}</span>
                            <span class="text-gray-500">· {{ $movimiento->producto->codigo }}</span>
                            @if ($movimiento->motivo)
                                <br><span class="text-xs text-gray-400">{{ $movimiento->motivo }}</span>
                            @endif
                        </td>
                        <td class="px-4 py-3">
                            <span class="px-2 py-0.5 rounded-full text-xs {{ $movimiento->tipo === 'entrada' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800' }}">
                                {{ $movimiento->tipo }}
                            </span>
                        </td>
                        <td class="px-4 py-3 text-right font-medium {{ $movimiento->tipo === 'entrada' ? 'text-green-700' : 'text-red-700' }}">
                            {{ $movimiento->tipo === 'entrada' ? '+' : '−' }}{{ $movimiento->cantidad }}
                        </td>
                        <td class="px-4 py-3 text-right">{{ $movimiento->stock_resultante }}</td>
                        <td class="px-4 py-3 text-gray-600">{{ $movimiento->usuario?->name ?? 'Usuario eliminado' }}</td>
                    </tr>
                @empty
                    <tr><td colspan="6" class="px-4 py-6 text-center text-gray-500">No hay movimientos para mostrar.</td></tr>
                @endforelse
            </tbody>
        </table>
    </div>

    {{-- Botones de página --}}
    <div class="mt-4">{{ $movimientos->links() }}</div>
@endsection