# backend/app.py (versión con SQLAlchemy y PostgreSQL)
from dotenv import load_dotenv # <--- AÑADE ESTO
load_dotenv()

import os
import sqlite3 # Dejamos sqlite3 temporalmente si aún lo necesitas para alguna lógica vieja o migración, pero ya no para la DB principal
from flask import Flask, jsonify, request
from flask_cors import CORS
from sqlalchemy import create_engine, Column, Integer, String, Float, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from sqlalchemy.exc import IntegrityError, SQLAlchemyError # Importamos excepciones de SQLAlchemy
from sqlalchemy import UniqueConstraint


DATABASE_URL = os.environ.get('DATABASE_URL') # Ahora leerá del .env o del entorno de Render
ADMIN_API_KEY = os.environ.get('ADMIN_API_KEY')
# Obtener la ruta del directorio actual del archivo app.py
BASE_DIR = os.path.dirname(os.path.abspath(__file__))


app = Flask(__name__)
CORS(app, origins="*", allow_headers=["Content-Type", "X-Api-Key"]) # Configuración de CORS

# --- Clave Secreta de Administración ---
ADMIN_API_KEY = os.environ.get('ADMIN_API_KEY', 'Tfebc6a3c-a8c0-4a88-b753-13982513feed')
 # <--- ¡CAMBIA ESTO!
# También carga esto desde una variable de entorno en Render para producción.

# --- Configuración de SQLAlchemy ---
Base = declarative_base() # Base para tus modelos de base de datos
engine = create_engine(DATABASE_URL) # Crea el motor de la base de datos
Session = sessionmaker(bind=engine) # Crea una clase de sesión

# --- Definición de Modelos (Tablas) con SQLAlchemy ---
class Marca(Base):
    __tablename__ = 'marcas'
    id_marca = Column(Integer, primary_key=True, autoincrement=True)
    nombre_marca = Column(String, nullable=False, unique=True)
    modelos = relationship("Modelo", back_populates="marca") # Relación con Modelo

class Modelo(Base):
    __tablename__ = 'modelos'
    id_modelo = Column(Integer, primary_key=True, autoincrement=True)
    nombre_modelo = Column(String, nullable=False, unique=True)
    # Añadimos la relación con Marca
    id_marca = Column(Integer, ForeignKey('marcas.id_marca'), nullable=False)
    marca = relationship("Marca", back_populates="modelos") # Relación con Marca
    reparaciones = relationship("Reparacion", back_populates="modelo") 
    __table_args__ = (UniqueConstraint('nombre_modelo', 'id_marca', name='_modelo_marca_uc'),)

class Reparacion(Base):
    __tablename__ = 'reparaciones'
    id_reparacion = Column(Integer, primary_key=True, autoincrement=True)
    id_modelo = Column(Integer, ForeignKey('modelos.id_modelo'), nullable=False)
    tipo_reparacion = Column(String, nullable=False)
    precio = Column(Float, nullable=False)
    disponibilidad = Column(String, nullable=False)
    descripcion_breve = Column(String)
    modelo = relationship("Modelo", back_populates="reparaciones") # Relación con Modelo

# --- Función para crear las tablas en la DB (solo se ejecuta una vez) ---
def create_tables():
    Base.metadata.create_all(engine)
    print("Tablas creadas o ya existentes en la base de datos PostgreSQL.")

# --- Funciones de Utilidad para obtener sesión de DB ---
def get_db_session():
    """Retorna una nueva sesión de SQLAlchemy para la base de datos."""
    return Session()

# --- Endpoints de la API (actualizados para usar SQLAlchemy) ---

@app.route('/marcas', methods=['GET'])
def get_marcas():
    session = get_db_session()
    try:
        marcas = session.query(Marca).all()
        return jsonify([{'id_marca': m.id_marca, 'nombre_marca': m.nombre_marca} for m in marcas])
    except Exception as e:
        return jsonify({"error": f"Error al obtener marcas: {str(e)}"}), 500
    finally:
        session.close()

@app.route('/modelos/<int:marca_id>', methods=['GET'])
def get_modelos_por_marca(marca_id):
    session = get_db_session()
    try:
        modelos = session.query(Modelo).filter_by(id_marca=marca_id).all()
        return jsonify([{'id_modelo': m.id_modelo, 'nombre_modelo': m.nombre_modelo} for m in modelos])
    except Exception as e:
        return jsonify({"error": f"Error al obtener modelos: {str(e)}"}), 500
    finally:
        session.close()

@app.route('/tipos_reparacion/<int:modelo_id>', methods=['GET'])
def get_tipos_reparacion_por_modelo(modelo_id):
    session = get_db_session()
    try:
        reparaciones = session.query(Reparacion).filter_by(id_modelo=modelo_id).all()
        reparaciones_list = [
            {
                'id_reparacion': r.id_reparacion,
                'tipo_reparacion': r.tipo_reparacion,
                'precio': r.precio,
                'disponibilidad': r.disponibilidad,
                'descripcion_breve': r.descripcion_breve
            } for r in reparaciones
        ]
        return jsonify(reparaciones_list)
    except Exception as e:
        return jsonify({"error": f"Error al obtener tipos de reparación: {str(e)}"}), 500
    finally:
        session.close()

@app.route('/cotizar', methods=['POST'])
def cotizar_reparacion():
    data = request.get_json()
    if not data or not all(k in data for k in ('marca_id', 'modelo_id', 'tipo_reparacion_id')):
        return jsonify({"error": "Faltan datos en la solicitud (marca_id, modelo_id, tipo_reparacion_id)"}), 400

    marca_id = data['marca_id']
    modelo_id = data['modelo_id']
    tipo_reparacion_id = data['tipo_reparacion_id']

    session = get_db_session()
    try:
        cotizacion = session.query(Reparacion, Modelo, Marca) \
                           .join(Modelo, Reparacion.id_modelo == Modelo.id_modelo) \
                           .join(Marca, Modelo.id_marca == Marca.id_marca) \
                           .filter(Marca.id_marca == marca_id,
                                   Modelo.id_modelo == modelo_id,
                                   Reparacion.id_reparacion == tipo_reparacion_id) \
                           .first() # first() en lugar de fetchone()

        if cotizacion:
            # cotizacion es una tupla de objetos (Reparacion, Modelo, Marca)
            rep, mod, mar = cotizacion
            return jsonify({
                "nombre_marca": mar.nombre_marca,
                "nombre_modelo": mod.nombre_modelo,
                "tipo_reparacion": rep.tipo_reparacion,
                "precio": rep.precio,
                "disponibilidad": rep.disponibilidad,
                "descripcion_breve": rep.descripcion_breve,
                "id_reparacion": rep.id_reparacion
            })
        else:
            return jsonify({"message": "No se encontró cotización para los parámetros dados."}), 404
    except Exception as e:
        return jsonify({"error": f"Error en la base de datos: {str(e)}"}), 500
    finally:
        session.close()

# --- Nuevas Rutas de Administración (CRUD para Reparaciones) ---

@app.route('/admin/marcas', methods=['GET'])
def get_admin_marcas():
    auth_header = request.headers.get('X-Api-Key')
    if not auth_header or auth_header != ADMIN_API_KEY:
        return jsonify({"error": "Acceso no autorizado."}), 401
    session = get_db_session()
    try:
        marcas = session.query(Marca).all()
        return jsonify([{'id_marca': m.id_marca, 'nombre_marca': m.nombre_marca} for m in marcas])
    except Exception as e:
        return jsonify({"error": f"Error al obtener marcas: {str(e)}"}), 500
    finally:
        session.close()

@app.route('/admin/modelos', methods=['GET'])
def get_all_modelos_with_brands():
    auth_header = request.headers.get('X-Api-Key')
    if not auth_header or auth_header != ADMIN_API_KEY:
        return jsonify({"error": "Acceso no autorizado."}), 401
    session = get_db_session()
    try:
        modelos = session.query(Modelo, Marca).join(Marca).order_by(Modelo.nombre_modelo).all()
        return jsonify([
            {
                'id_modelo': mod.id_modelo,
                'nombre_modelo': mod.nombre_modelo,
                'id_marca': mar.id_marca,
                'nombre_marca': mar.nombre_marca
            } for mod, mar in modelos
        ])
    except Exception as e:
        return jsonify({"error": f"Error al obtener modelos con marcas: {str(e)}"}), 500
    finally:
        session.close()

@app.route('/admin/reparacion/<int:id_reparacion>', methods=['GET'])
def get_reparacion_by_id(id_reparacion):
    auth_header = request.headers.get('X-Api-Key')
    if not auth_header or auth_header != ADMIN_API_KEY:
        return jsonify({"error": "Acceso no autorizado."}), 401

    session = get_db_session()
    try:
        reparacion = session.query(Reparacion, Modelo, Marca) \
                            .join(Modelo, Reparacion.id_modelo == Modelo.id_modelo) \
                            .join(Marca, Modelo.id_marca == Marca.id_marca) \
                            .filter(Reparacion.id_reparacion == id_reparacion) \
                            .first()

        if reparacion:
            rep, mod, mar = reparacion
            return jsonify({
                'id_reparacion': rep.id_reparacion,
                'id_modelo': rep.id_modelo,
                'tipo_reparacion': rep.tipo_reparacion,
                'precio': rep.precio,
                'disponibilidad': rep.disponibilidad,
                'descripcion_breve': rep.descripcion_breve,
                'nombre_modelo': mod.nombre_modelo,
                'nombre_marca': mar.nombre_marca
            })
        else:
            return jsonify({"message": "Reparación no encontrada."}), 404
    except Exception as e:
        return jsonify({"error": f"Error al obtener reparación: {str(e)}"}), 500
    finally:
        session.close()

@app.route('/admin/reparaciones', methods=['GET'])
def get_all_reparaciones():
    auth_header = request.headers.get('X-Api-Key')
    if not auth_header or auth_header != ADMIN_API_KEY:
        return jsonify({"error": "Acceso no autorizado."}), 401

    session = get_db_session()
    try:
        reparaciones = session.query(Reparacion, Modelo, Marca) \
                               .join(Modelo, Reparacion.id_modelo == Modelo.id_modelo) \
                               .join(Marca, Modelo.id_marca == Marca.id_marca) \
                               .order_by(Reparacion.id_reparacion.desc()) \
                               .all()
        
        reparaciones_list = [
            {
                'id_reparacion': rep.id_reparacion,
                'tipo_reparacion': rep.tipo_reparacion,
                'precio': rep.precio,
                'disponibilidad': rep.disponibilidad,
                'descripcion_breve': rep.descripcion_breve,
                'id_modelo': rep.id_modelo,
                'nombre_modelo': mod.nombre_modelo,
                'id_marca': mod.id_marca,
                'nombre_marca': mar.nombre_marca
            } for rep, mod, mar in reparaciones
        ]
        return jsonify(reparaciones_list)
    except Exception as e:
        return jsonify({"error": f"Error al obtener reparaciones: {str(e)}"}), 500
    finally:
        session.close()


@app.route('/admin/reparacion', methods=['POST'])
def add_reparacion():
    auth_header = request.headers.get('X-Api-Key')
    if not auth_header or auth_header != ADMIN_API_KEY:
        return jsonify({"error": "Acceso no autorizado."}), 401

    data = request.get_json()
    required_fields = ['id_modelo', 'tipo_reparacion', 'precio', 'disponibilidad']
    if not all(field in data for field in required_fields):
        return jsonify({"error": "Faltan campos requeridos: id_modelo, tipo_reparacion, precio, disponibilidad."}), 400

    new_reparacion = Reparacion(
        id_modelo=data['id_modelo'],
        tipo_reparacion=data['tipo_reparacion'],
        precio=data['precio'],
        disponibilidad=data['disponibilidad'],
        descripcion_breve=data.get('descripcion_breve', None)
    )

    session = get_db_session()
    try:
        session.add(new_reparacion)
        session.commit()
        return jsonify({"message": "Reparación agregada exitosamente", "id_reparacion": new_reparacion.id_reparacion}), 201
    except IntegrityError:
        session.rollback() # Hacer rollback en caso de error de integridad (ej. id_modelo inexistente)
        return jsonify({"error": "Error: El ID de modelo especificado no existe o hay un problema de integridad."}), 400
    except Exception as e:
        session.rollback()
        return jsonify({"error": f"Error al agregar reparación: {str(e)}"}), 500
    finally:
        session.close()


@app.route('/admin/reparacion/<int:id_reparacion>', methods=['PUT'])
def update_reparacion(id_reparacion):
    auth_header = request.headers.get('X-Api-Key')
    if not auth_header or auth_header != ADMIN_API_KEY:
        return jsonify({"error": "Acceso no autorizado."}), 401

    data = request.get_json()
    session = get_db_session()
    try:
        reparacion = session.query(Reparacion).filter_by(id_reparacion=id_reparacion).first()
        if not reparacion:
            return jsonify({"message": "Reparación no encontrada."}), 404

        if 'id_modelo' in data:
            reparacion.id_modelo = data['id_modelo']
        if 'tipo_reparacion' in data:
            reparacion.tipo_reparacion = data['tipo_reparacion']
        if 'precio' in data:
            reparacion.precio = data['precio']
        if 'disponibilidad' in data:
            reparacion.disponibilidad = data['disponibilidad']
        if 'descripcion_breve' in data:
            reparacion.descripcion_breve = data['descripcion_breve']
        
        session.commit()
        return jsonify({"message": "Reparación actualizada exitosamente."}), 200
    except IntegrityError:
        session.rollback()
        return jsonify({"error": "Error: El ID de modelo especificado no existe o hay un problema de integridad."}), 400
    except Exception as e:
        session.rollback()
        return jsonify({"error": f"Error al actualizar reparación: {str(e)}"}), 500
    finally:
        session.close()


@app.route('/admin/reparacion/<int:id_reparacion>', methods=['DELETE'])
def delete_reparacion(id_reparacion):
    auth_header = request.headers.get('X-Api-Key')
    if not auth_header or auth_header != ADMIN_API_KEY:
        return jsonify({"error": "Acceso no autorizado."}), 401

    session = get_db_session()
    try:
        reparacion = session.query(Reparacion).filter_by(id_reparacion=id_reparacion).first()
        if not reparacion:
            return jsonify({"message": "Reparación no encontrada."}), 404
        
        session.delete(reparacion)
        session.commit()
        return jsonify({"message": "Reparación eliminada exitosamente."}), 200
    except Exception as e:
        session.rollback()
        return jsonify({"error": f"Error al eliminar reparación: {str(e)}"}), 500
    finally:
        session.close()



@app.route('/admin/marca', methods=['POST'])
def add_marca():
    auth_header = request.headers.get('X-Api-Key')
    if not auth_header or auth_header != ADMIN_API_KEY:
        return jsonify({"error": "Acceso no autorizado."}), 401

    data = request.get_json()
    if not data or 'nombre_marca' not in data:
        return jsonify({"error": "Falta el campo requerido: nombre_marca."}), 400

    nombre_marca = data['nombre_marca'].strip() # Limpiar espacios en blanco

    session = get_db_session()
    try:
        new_marca = Marca(nombre_marca=nombre_marca)
        session.add(new_marca)
        session.commit()
        return jsonify({"message": "Marca agregada exitosamente", "id_marca": new_marca.id_marca}), 201
    except IntegrityError:
        session.rollback()
        return jsonify({"error": "Error: Una marca con ese nombre ya existe."}), 400
    except Exception as e:
        session.rollback()
        return jsonify({"error": f"Error al agregar marca: {str(e)}"}), 500
    finally:
        session.close()


# --- Modificación de la Ruta POST para agregar un nuevo Modelo ---
# Acepta id_marca O nombre_marca
@app.route('/admin/modelo', methods=['POST'])
def add_modelo():
    auth_header = request.headers.get('X-Api-Key')
    if not auth_header or auth_header != ADMIN_API_KEY:
        return jsonify({"error": "Acceso no autorizado."}), 401

    data = request.get_json()
    if not data or 'nombre_modelo' not in data:
        return jsonify({"error": "Falta el campo requerido: nombre_modelo."}), 400

    nombre_modelo = data['nombre_modelo'].strip() # Limpiar espacios en blanco
    id_marca = None

    session = get_db_session()
    try:
        if 'id_marca' in data and data['id_marca']: # Si se proporciona un id_marca
            id_marca = data['id_marca']
            marca_existe = session.query(Marca).filter_by(id_marca=id_marca).first()
            if not marca_existe:
                return jsonify({"error": "El ID de marca especificado no existe."}), 400
        elif 'nombre_marca' in data and data['nombre_marca'].strip(): # Si se proporciona un nombre_marca
            nombre_marca_nueva = data['nombre_marca'].strip()
            # Buscar si la marca ya existe por nombre
            marca_existente = session.query(Marca).filter_by(nombre_marca=nombre_marca_nueva).first()
            if marca_existente:
                id_marca = marca_existente.id_marca
            else:
                # Si no existe, crearla
                new_marca = Marca(nombre_marca=nombre_marca_nueva)
                session.add(new_marca)
                session.flush() # flush para que la marca_nueva obtenga su ID antes del commit
                id_marca = new_marca.id_marca
        else:
            return jsonify({"error": "Debes proporcionar un 'id_marca' o un 'nombre_marca'."}), 400

        # Crear el nuevo modelo con el id_marca obtenido/creado
        new_modelo = Modelo(nombre_modelo=nombre_modelo, id_marca=id_marca)
        session.add(new_modelo)
        session.commit()
        return jsonify({"message": "Modelo agregado exitosamente", "id_modelo": new_modelo.id_modelo}), 201

    except IntegrityError:
        session.rollback()
        return jsonify({"error": "Error: Un modelo con ese nombre ya existe o hay un problema de integridad de datos."}), 400
    except Exception as e:
        session.rollback()
        return jsonify({"error": f"Error al agregar modelo: {str(e)}"}), 500
    finally:
        session.close()
# --- Ejecutar la Aplicación Flask ---

if __name__ == '__main__':
    # Asegúrate de llamar a create_tables() SOLO LA PRIMERA VEZ
    # Cuando despliegues en Render, las tablas se crearán automáticamente.
    # Si ya tienes datos en SQLite y quieres migrarlos, ese es un paso manual aparte.
    # Para probar localmente, puedes descomentar esta línea la primera vez que ejecutes.
    #create_tables()
    app.run(debug=True, port=5000, host='0.0.0.0')