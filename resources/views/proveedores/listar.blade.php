@extends('layouts.principal')

@section('titulo', 'Proveedores')

@section('contenido')
    <h1 class="text-2xl font-bold mb-4">Proveedores</h1>

    @if (session('exito'))
        <div class="mb-4 p-3 bg-green-50 border border-green-200 text-green-800 rounded-lg text-sm">
            {{ session('exito') }}
        </div>
    @endif

    <div class="grid gap-6 lg:grid-cols-3">

        {{-- Formulario de alta --}}
        <form method="POST" action="{{ route('proveedores.guardar') }}" class="bg-white rounded-xl shadow p-5 space-y-3 h-fit">
            @csrf
            <h2 class="font-semibold">Nuevo proveedor</h2>

            <div>
                <label class="block text-sm font-medium mb-1">Nombre</label>
                <input type="text" name="nombre" value="{{ old('nombre') }}"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                @error('nombre') <p class="text-xs text-red-600 mt-1">{{ $message }}</p> @enderror
            </div>
            <div>
                <label class="block text-sm font-medium mb-1">Email <span class="text-gray-400 font-normal">(opcional)</span></label>
                <input type="text" name="email" value="{{ old('email') }}"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                @error('email') <p class="text-xs text-red-600 mt-1">{{ $message }}</p> @enderror
            </div>
            <div>
                <label class="block text-sm font-medium mb-1">Teléfono <span class="text-gray-400 font-normal">(opcional)</span></label>
                <input type="text" name="telefono" value="{{ old('telefono') }}"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                @error('telefono') <p class="text-xs text-red-600 mt-1">{{ $message }}</p> @enderror
            </div>

            <button type="submit" class="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg">
                Crear proveedor
            </button>
        </form>

        {{-- Tabla --}}
        <div class="lg:col-span-2 bg-white rounded-xl shadow overflow-x-auto">
            <table class="w-full text-sm">
                <thead class="bg-gray-50 text-left text-gray-600">
                    <tr>
                        <th class="px-4 py-3">Nombre</th>
                        <th class="px-4 py-3">Contacto</th>
                        <th class="px-4 py-3 text-center">Prendas</th>
                        <th class="px-4 py-3"></th>
                    </tr>
                </thead>
                <tbody>
                    @forelse ($proveedores as $proveedor)
                        <tr class="border-t border-gray-100">
                            <td class="px-4 py-3 font-medium">{{ $proveedor->nombre }}</td>
                            <td class="px-4 py-3 text-gray-600">
                                {{ $proveedor->email ?? '—' }}<br>
                                <span class="text-gray-400">{{ $proveedor->telefono ?? '' }}</span>
                            </td>
                            <td class="px-4 py-3 text-center">{{ $proveedor->productos_count }}</td>
                            <td class="px-4 py-3">
                                <div class="flex justify-end gap-2">
                                    <a href="{{ route('proveedores.editar', $proveedor) }}"
                                        class="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50">Editar</a>
                                    <form method="POST" action="{{ route('proveedores.eliminar', $proveedor) }}"
                                        onsubmit="return confirm('¿Eliminar a {{ $proveedor->nombre }}? Se quitará de todas las prendas.')">
                                        @csrf
                                        @method('DELETE')
                                        <button type="submit"
                                            class="px-3 py-1 border border-red-300 text-red-600 rounded-lg hover:bg-red-50">Eliminar</button>
                                    </form>
                                </div>
                            </td>
                        </tr>
                    @empty
                        <tr><td colspan="4" class="px-4 py-6 text-center text-gray-500">Todavía no hay proveedores.</td></tr>
                    @endforelse
                </tbody>
            </table>
        </div>
    </div>
@endsection