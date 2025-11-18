
import os
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import (FastAPI, Depends, HTTPException, status, File, UploadFile,
                     APIRouter)
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from lxml import etree
from passlib.context import CryptContext
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings
from sqlalchemy import (create_engine, Column, Integer, String, Float,
                        DateTime, ForeignKey, Text)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship

# --- CONFIGURATION ---
class Settings(BaseSettings):
    # ATENÇÃO: Substitua esta URL pela connection string do seu Vercel Postgres
    # Você a encontrará nas variáveis de ambiente do seu projeto Vercel.
    DATABASE_URL: str = os.environ.get("POSTGRES_URL_NON_POOLING") or "postgresql://user:password@host:port/db"
    SECRET_KEY: str = "uma-chave-secreta-muito-forte-deve-ser-colocada-aqui"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 # 24 horas

    class Config:
        env_file = ".env"

settings = Settings()

# --- DATABASE SETUP ---
engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- PASSWORD HASHING ---
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# --- AUTHENTICATION ---
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# --- DATABASE MODELS (SQLAlchemy) ---

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="user")
    created_at = Column(DateTime, default=datetime.utcnow)

class Supplier(Base):
    __tablename__ = "suppliers"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    cnpj = Column(String, unique=True, index=True)
    address = Column(String)
    fda = Column(String)
    email = Column(String)
    salesperson = Column(String)
    phone = Column(String)
    products = relationship("Product", back_populates="supplier")

class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    name_en = Column(String)
    code = Column(String, index=True)
    ncm = Column(String)
    description = Column(Text)
    quantity = Column(Float, default=0)
    min_quantity = Column(Float, default=0)
    cost_price = Column(Float, default=0)
    sale_price = Column(Float, default=0)
    package_type = Column(String) # ex: 'caixa', 'fardo'
    units_per_package = Column(Integer, default=1)
    unit_measure_value = Column(Float, default=1)
    unit_measure_type = Column(String) # ex: 'kg', 'g', 'un'
    image = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"))
    supplier = relationship("Supplier", back_populates="products")


# --- PYDANTIC SCHEMAS (for API validation) ---

class ProductBase(BaseModel):
    name: str
    code: str
    quantity: float
    cost_price: float
    sale_price: float
    supplier_id: int

class ProductCreate(ProductBase):
    pass

class ProductSchema(ProductBase):
    id: int
    class Config:
        from_attributes = True

class SupplierBase(BaseModel):
    name: str
    cnpj: Optional[str] = None

class SupplierCreate(SupplierBase):
    pass

class SupplierSchema(SupplierBase):
    id: int
    products: List[ProductSchema] = []
    class Config:
        from_attributes = True

class UserBase(BaseModel):
    username: str

class UserCreate(UserBase):
    password: str
    role: str = "user"

class UserSchema(UserBase):
    id: int
    role: str
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

# --- UTILITY FUNCTIONS ---

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError:
        raise credentials_exception
    user = db.query(User).filter(User.username == token_data.username).first()
    if user is None:
        raise credentials_exception
    return user

# --- API ROUTERS ---

# Router for Authentication
auth_router = APIRouter()

@auth_router.post("/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@auth_router.post("/users/", response_model=UserSchema)
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    hashed_password = get_password_hash(user.password)
    db_user = User(username=user.username, hashed_password=hashed_password, role=user.role)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

# Router for main API endpoints
api_router = APIRouter()

@api_router.get("/products/", response_model=List[ProductSchema])
def read_products(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    products = db.query(Product).offset(skip).limit(limit).all()
    return products

# --- XML PARSING LOGIC (from original file) ---
# Note: This is kept as a utility function. The endpoint is below.

def parse_nfe_xml(xml_content: bytes):
    try:
        root = etree.fromstring(xml_content)
        ns = {'nfe': 'http://www.portalfiscal.inf.br/nfe'}

        infNFe = root.find('.//nfe:infNFe', ns)
        if infNFe is None: return None
        
        ide = infNFe.find('nfe:ide', ns)
        emit = infNFe.find('nfe:emit', ns)
        
        # Basic data extraction with fallbacks
        get_text = lambda elem, path, ns, default='': (t.text.strip() if t is not None and t.text else default)
        get_value = lambda elem, path, ns, default=0.0: float(get_text(elem, path, ns, default) or default)

        all_products = []
        for det in infNFe.findall('nfe:det', ns):
            prod = det.find('nfe:prod', ns)
            if prod is None: continue
            
            product_data = {
                "code": get_text(prod, 'nfe:cProd', ns),
                "name": get_text(prod, 'nfe:xProd', ns, 'N/A'),
                "ncm": get_text(prod, 'nfe:NCM', ns, 'N/A'),
                "quantity": get_value(prod, 'nfe:qCom', ns),
                "costPrice": get_value(prod, 'nfe:vUnCom', ns),
                "totalPriceBRL": get_value(prod, 'nfe:vProd', ns),
            }
            all_products.append(product_data)

        supplier_name = get_text(emit, 'nfe:xNome', ns, 'N/A')
        cnpj = get_text(emit, 'nfe:CNPJ', ns)

        return {
            "fornecedor": {"nome": supplier_name, "cnpj": cnpj},
            "produtos": all_products,
        }
    except Exception as e:
        # In a real app, log this error
        print(f"Error parsing XML: {e}")
        return None

@api_router.post("/upload-xml/")
async def upload_xml_file(file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    if not file.filename.endswith('.xml'):
        raise HTTPException(status_code=400, detail="Apenas ficheiros XML são permitidos.")
    
    xml_content = await file.read()
    parsed_data = parse_nfe_xml(xml_content)
    
    if not parsed_data or not parsed_data.get("produtos"):
        raise HTTPException(status_code=404, detail="Nenhum produto encontrado no XML ou formato não suportado.")
        
    return JSONResponse(content=parsed_data)


# --- MAIN FASTAPI APP ---
app = FastAPI(title="Controle de Estoque API")

# Include the routers
app.include_router(auth_router, tags=["Authentication"])
app.include_router(api_router, prefix="/api", tags=["API"])

@app.on_event("startup")
def on_startup():
    # This will create the tables in the database on startup.
    # For production, a migration tool like Alembic is recommended.
    try:
        Base.metadata.create_all(bind=engine)

        # Create a default admin user if one doesn't exist
        db = SessionLocal()
        admin = db.query(User).filter(User.username == "admin").first()
        if not admin:
            hashed_password = get_password_hash("admin123")
            admin_user = User(username="admin", hashed_password=hashed_password, role="admin")
            db.add(admin_user)
            db.commit()
            print("Default admin user created with password 'admin123'")
        db.close()
    except Exception as e:
        print(f"Error during startup database setup: {e}")
        # This might happen if the DB is not ready. In a real app, handle this with retries.


@app.get("/")
def read_root():
    return {"message": "Bem-vindo à API do Controle de Estoque. Acesse /docs para ver a documentação."}

