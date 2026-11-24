@extends('layouts.principal')

@section('titulo', 'Ingresar')

@section('contenido')
    <div class="max-w-sm mx-auto mt-10 bg-white rounded-xl shadow p-6">
        <h1 class="text-2xl font-bold mb-1">Ingresar</h1>
        <p class="text-sm text-gray-500 mb-5">Accedé con tu usuario para gestionar el almacén.</p>

        <form method="POST" action="{{ route('login.ingresar') }}" class="space-y-4">
            @csrf

            <div>
                <label class="block text-sm font-medium mb-1" for="email">Email</label>
                <input id="email" type="email" name="email" value="{{ old('email') }}" autofocus
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                @error('email')
                    <p class="text-xs text-red-600 mt-1">{{ $message }}</p>
                @enderror
            </div>

            <div>
                <label class="block text-sm font-medium mb-1" for="password">Contraseña</label>
                <input id="password" type="password" name="password"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                @error('password')
                    <p class="text-xs text-red-600 mt-1">{{ $message }}</p>
                @enderror
            </div>

            <label class="flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" name="recordar" value="1"> Recordarme
            </label>

            <button type="submit" class="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
                Ingresar
            </button>
        </form>
    </div>
@endsection