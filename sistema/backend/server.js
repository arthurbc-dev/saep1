const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto'); // criptografia nativa do Node (scrypt), sem instalar nada
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;


app.use(cors());
app.use(express.json());

// ---------- Banco de dados SQLite ----------
const DB_FILE = path.join(__dirname, 'saep.db');
const SQL_FILE = path.join(__dirname, '..', '..', 'saep_db.sql');
const bancoNovo = !fs.existsSync(DB_FILE);

const db = new sqlite3.Database(DB_FILE);
db.run('PRAGMA foreign_keys = ON'); // faz o SQLite respeitar as chaves estrangeiras

// Na primeira execução, roda o saep_db.sql (cria tabelas + dados de exemplo).
if (bancoNovo) {
  db.exec(fs.readFileSync(SQL_FILE, 'utf8'), (err) => {
    if (err) console.error('Erro ao executar saep_db.sql:', err.message);
    else console.log('Banco criado a partir do saep_db.sql');
  });
}

// Versões com Promise dos métodos do sqlite3 (para usar async/await)
const all = (sql, p = []) => new Promise((ok, erro) => db.all(sql, p, (e, r) => (e ? erro(e) : ok(r))));
const get = (sql, p = []) => new Promise((ok, erro) => db.get(sql, p, (e, r) => (e ? erro(e) : ok(r))));
const run = (sql, p = []) =>
  new Promise((ok, erro) => db.run(sql, p, function (e) { e ? erro(e) : ok(this); }));

// ---------- Criptografia ----------
// Hash com "salt" aleatório: o texto original NÃO pode ser recuperado.
// Formato salvo no banco:  salt:hash
function criptografar(texto) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(texto, salt, 32).toString('hex');
  return `${salt}:${hash}`;
}
function confere(texto, guardado) {
  const [salt, hash] = guardado.split(':');
  const novo = crypto.scryptSync(texto, salt, 32);
  return crypto.timingSafeEqual(novo, Buffer.from(hash, 'hex'));
}
const soDigitos = (s) => String(s || '').replace(/\D/g, '');

// =====================================================
// AUTH
// =====================================================
// REGRA "Login": credenciais erradas => 401 com mensagem (o front exibe o erro).
app.post('/login', async (req, res) => {
  try {
    const { login, senha } = req.body;
    const usuario = await get('SELECT * FROM usuarios WHERE login = ?', [login]);
    if (!usuario || !confere(senha || '', usuario.senha)) {
      return res.status(401).json({ erro: 'Usuário ou senha inválidos.' });
    }
    res.json({ id: usuario.id, nome: usuario.nome });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// =====================================================
// TUTORES
// =====================================================
// REGRA "Tutores (Busca)": ?busca=texto filtra por nome, e-mail ou telefone.
// O CPF nunca é devolvido pela API (está criptografado).
app.get('/tutores', async (req, res) => {
  try {
    const busca = `%${(req.query.busca || '').trim()}%`;
    const tutores = await all(
      `SELECT id, nome, telefone, email FROM tutores
       WHERE nome LIKE ? OR email LIKE ? OR telefone LIKE ?
       ORDER BY nome`,
      [busca, busca, busca]
    );
    res.json(tutores);
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// Cadastro de tutor
app.post('/tutores', async (req, res) => {
  try {
    const { nome, cpf, telefone, email } = req.body;
    const cpfLimpo = soDigitos(cpf);
    if (!nome || cpfLimpo.length !== 11) {
      return res.status(400).json({ erro: 'Informe o nome e um CPF com 11 dígitos.' });
    }
    // REGRA "Criptografia": o CPF é criptografado ANTES de ir para o SQLite.
    const cpfCriptografado = criptografar(cpfLimpo);
    const r = await run(
      'INSERT INTO tutores (nome, cpf, telefone, email) VALUES (?, ?, ?, ?)',
      [nome, cpfCriptografado, telefone, email]
    );
    res.status(201).json({ id: r.lastID });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// REGRA "Tutores (Edição)": atualiza os dados e salva no banco.
// O CPF só é alterado se um novo for digitado (e, nesse caso, é criptografado de novo).
app.put('/tutores/:id', async (req, res) => {
  try {
    const { nome, cpf, telefone, email } = req.body;
    if (!nome) return res.status(400).json({ erro: 'O nome é obrigatório.' });

    const cpfLimpo = soDigitos(cpf);
    if (cpfLimpo) {
      if (cpfLimpo.length !== 11) return res.status(400).json({ erro: 'CPF deve ter 11 dígitos.' });
      await run('UPDATE tutores SET nome=?, cpf=?, telefone=?, email=? WHERE id=?',
        [nome, criptografar(cpfLimpo), telefone, email, req.params.id]);
    } else {
      await run('UPDATE tutores SET nome=?, telefone=?, email=? WHERE id=?',
        [nome, telefone, email, req.params.id]);
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// =====================================================
// PETS
// =====================================================
app.get('/pets', async (req, res) => {
  try {
    const pets = await all(
      `SELECT p.id, p.nome, p.especie, p.raca, p.data_nascimento, t.nome AS tutor
       FROM pets p JOIN tutores t ON t.id = p.tutor_id
       ORDER BY p.nome`
    );
    res.json(pets);
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// REGRA "Pets (Cadastro)": o pet só é salvo se o tutor existir.
app.post('/pets', async (req, res) => {
  try {
    const { nome, especie, raca, data_nascimento, tutor_id } = req.body;
    if (!nome || !especie || !tutor_id) {
      return res.status(400).json({ erro: 'Nome, espécie e tutor são obrigatórios.' });
    }
    const tutor = await get('SELECT id FROM tutores WHERE id = ?', [tutor_id]);
    if (!tutor) return res.status(400).json({ erro: 'Tutor não encontrado.' });

    const r = await run(
      'INSERT INTO pets (nome, especie, raca, data_nascimento, tutor_id) VALUES (?, ?, ?, ?, ?)',
      [nome, especie, raca, data_nascimento || null, tutor_id]
    );
    res.status(201).json({ id: r.lastID });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// =====================================================
// AGENDAMENTOS
// =====================================================
// REGRA "Agendamentos (Listagem)": JOIN traz dados do agendamento + pet + tutor,
// e o ORDER BY ordena pela data do agendamento.
app.get('/agendamentos', async (req, res) => {
  try {
    const lista = await all(
      `SELECT a.id, a.data_agendamento, a.servico, a.status,
              p.nome AS pet, p.especie,
              t.nome AS tutor, t.telefone
       FROM agendamentos a
       JOIN pets p    ON p.id = a.pet_id
       JOIN tutores t ON t.id = p.tutor_id
       ORDER BY a.data_agendamento ASC`
    );
    res.json(lista);
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// Novo agendamento (extra, para a tela ficar completa)
app.post('/agendamentos', async (req, res) => {
  try {
    const { pet_id, data_agendamento, servico } = req.body;
    if (!pet_id || !data_agendamento || !servico) {
      return res.status(400).json({ erro: 'Pet, data e serviço são obrigatórios.' });
    }
    const r = await run(
      'INSERT INTO agendamentos (pet_id, data_agendamento, servico) VALUES (?, ?, ?)',
      [pet_id, data_agendamento, servico]
    );
    res.status(201).json({ id: r.lastID });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// REGRA "Agendamentos (Edição)": o UPDATE mexe SOMENTE na coluna data_agendamento.
app.put('/agendamentos/:id', async (req, res) => {
  try {
    const { data_agendamento } = req.body;
    if (!data_agendamento) return res.status(400).json({ erro: 'Informe a nova data.' });
    await run('UPDATE agendamentos SET data_agendamento = ? WHERE id = ?',
      [data_agendamento, req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

app.listen(PORT, () => console.log(`API rodando em http://localhost:${PORT}`));
