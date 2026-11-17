PRAGMA foreign_keys = ON;

DROP TABLE IF EXISTS agendamentos;
DROP TABLE IF EXISTS pets;
DROP TABLE IF EXISTS tutores;
DROP TABLE IF EXISTS usuarios;

CREATE TABLE usuarios (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    nome    VARCHAR(100) NOT NULL,
    login   VARCHAR(50)  NOT NULL UNIQUE,
    senha   VARCHAR(200) NOT NULL
);

CREATE TABLE tutores (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    nome      VARCHAR(100) NOT NULL,
    cpf       VARCHAR(200) NOT NULL,
    telefone  VARCHAR(20),
    email     VARCHAR(100)
);

CREATE TABLE pets (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    nome             VARCHAR(50) NOT NULL,
    especie          VARCHAR(30) NOT NULL,
    raca             VARCHAR(50),
    data_nascimento  DATE,
    tutor_id         INTEGER NOT NULL,
    FOREIGN KEY (tutor_id) REFERENCES tutores(id)
);

CREATE TABLE agendamentos (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    pet_id            INTEGER NOT NULL,
    data_agendamento  DATETIME NOT NULL,
    servico           VARCHAR(100) NOT NULL,
    status            VARCHAR(20) NOT NULL DEFAULT 'Agendado',
    FOREIGN KEY (pet_id) REFERENCES pets(id)
);

-- ---------- Dados iniciais ----------
-- Logins de teste: admin/admin123 | camila/vet123 | recepcao/123456
INSERT INTO usuarios (nome, login, senha) VALUES
('Usuário Administrador', 'admin',    '581c39d98fe224d04c1e5b189a979baa:1aa5f171a973fee298f75bfd59c23b5392da1d3a9c982dbda3ce9d28e348e526'),
('Usuário Veterinário',   'camila',   'de23c49b5a182acb93434a1991a6bb82:96534ecc440f38461cf20e2ea84c3f9c088239d8efcc91a54d8b2bc3367d1ed'),
('Usuário Recepção',      'recepcao', '979e7b369feb4eb1cf22490676f49a78:387a6b3fc5c8bddb809f47c588ed403c54920888ad75a7754ce11ca1380d59ca');

INSERT INTO tutores (nome, cpf, telefone, email) VALUES
('Tutor Exemplo 1', 'bd0b95150a9f3d0b8cf553176c6f5847:7bff2c907e4718463b010753d52c0eff7ebe5382959266ff1c1ff39c16ef0de5', '(00) 00000-0001', 'tutor1@example.com'),
('Tutor Exemplo 2', '83c8ff3f8347e6d55cbdc3365fc07a46:e078b1d1e91a1fc3a6146f1b1b4d9fca66a2d3e92a8e2be103a5757a92e38204', '(00) 00000-0002', 'tutor2@example.com'),
('Tutor Exemplo 3', '66f69e26d865fda1d0724d7eb4ef7363:5551bcb7b6278027238560181a51a88d509a6cabc20cb5794f16b73ec0082665', '(00) 00000-0003', 'tutor3@example.com'),
('Tutor Exemplo 4', '081db88bd5e9041a3d429a7e235be5bb:65cbd69e4b53222b0bdc1faa081313ae0376e208458ad24b0c6294f828b6f1b7', '(00) 00000-0004', 'tutor4@example.com');

INSERT INTO pets (nome, especie, raca, data_nascimento, tutor_id) VALUES
('Pet Exemplo 1', 'Cachorro', 'SRD', '2022-01-10', 1),
('Pet Exemplo 2', 'Gato',     'SRD', '2021-06-15', 2),
('Pet Exemplo 3', 'Cachorro', 'SRD', '2020-09-20', 3),
('Pet Exemplo 4', 'Gato',     'SRD', '2023-03-05', 1),
('Pet Exemplo 5', 'Coelho',   'SRD', '2024-02-12', 4);

INSERT INTO agendamentos (pet_id, data_agendamento, servico, status) VALUES
(3, '2026-12-03T10:00', 'Consulta',   'Agendado'),
(1, '2026-12-01T09:30', 'Retorno',    'Agendado'),
(5, '2026-12-05T15:00', 'Avaliação', 'Agendado'),
(2, '2026-12-02T14:00', 'Vacinação', 'Agendado'),
(4, '2026-11-16T11:00', 'Consulta',   'Concluído');
