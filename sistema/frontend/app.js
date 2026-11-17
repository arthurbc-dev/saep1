// =====================================================
// app.js - lógica de TODAS as telas (fetch + DOM)
// Cada página tem <body data-pagina="..."> e só roda o trecho dela.
// =====================================================
const API = 'http://localhost:3000';
const pagina = document.body.dataset.pagina;

// ---------- Utilitários ----------
const $ = (id) => document.getElementById(id);

// Escapa texto vindo do banco antes de colocar no HTML (evita injeção de HTML)
function esc(texto) {
  const div = document.createElement('div');
  div.textContent = texto ?? '';
  return div.innerHTML;
}

// Mostra "2026-11-20T14:00" como "20/11/2026 14:00"
function formatarDataHora(iso) {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}
function formatarData(iso) {
  return iso ? new Date(iso + 'T00:00').toLocaleDateString('pt-BR') : '-';
}

// Chamada à API com tratamento de erro
async function api(caminho, opcoes = {}) {
  const resp = await fetch(API + caminho, {
    headers: { 'Content-Type': 'application/json' },
    ...opcoes,
  });
  const dados = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(dados.erro || 'Erro na requisição');
  return dados;
}

function mostrarErro(idElemento, mensagem) {
  const el = $(idElemento);
  el.textContent = mensagem;
  el.hidden = !mensagem;
}

// ---------- Sessão (localStorage) ----------
// Se não estiver logado, qualquer página (exceto o login) volta para o login.
const usuarioNome = localStorage.getItem('usuarioNome');
if (pagina !== 'login' && !usuarioNome) {
  window.location.href = 'index.html';
}

// Nome do usuário no cabeçalho + botão Sair (logout)
if ($('nomeUsuario')) $('nomeUsuario').textContent = usuarioNome;
if ($('boasVindas')) $('boasVindas').textContent = usuarioNome;
if ($('btnSair')) {
  $('btnSair').addEventListener('click', () => {
    localStorage.removeItem('usuarioNome'); // logout: apaga a sessão
    window.location.href = 'index.html';
  });
}

// =====================================================
// LOGIN
// =====================================================
if (pagina === 'login') {
  // Já logado? vai direto para o dashboard
  if (localStorage.getItem('usuarioNome')) window.location.href = 'dashboard.html';

  $('formLogin').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const usuario = await api('/login', {
        method: 'POST',
        body: JSON.stringify({ login: $('login').value, senha: $('senha').value }),
      });
      localStorage.setItem('usuarioNome', usuario.nome);
      window.location.href = 'dashboard.html';
    } catch (erro) {
      // Validação do login: mostra a mensagem de erro na tela
      mostrarErro('msgErro', erro.message);
    }
  });
}

// =====================================================
// TUTORES (busca + cadastro + edição)
// =====================================================
if (pagina === 'tutores') {
  let tutores = []; // guarda a lista atual para preencher o formulário na edição

  async function carregarTutores(busca = '') {
    tutores = await api('/tutores?busca=' + encodeURIComponent(busca));
    $('tabelaTutores').innerHTML = tutores.length
      ? tutores.map((t) => `
          <tr>
            <td>${esc(t.nome)}</td>
            <td>Protegido</td>
            <td>${esc(t.telefone)}</td>
            <td>${esc(t.email)}</td>
            <td><button onclick="editarTutor(${t.id})">Editar</button></td>
          </tr>`).join('')
      : '<tr><td colspan="5">Nenhum tutor encontrado.</td></tr>';
  }

  // BUSCA: ao confirmar, recarrega a tabela só com os resultados filtrados
  $('formBusca').addEventListener('submit', (e) => {
    e.preventDefault();
    carregarTutores($('busca').value);
  });
  $('btnLimparBusca').addEventListener('click', () => {
    $('busca').value = '';
    carregarTutores();
  });

  // EDIÇÃO: joga os dados do tutor no formulário (CPF fica vazio = não alterar)
  window.editarTutor = (id) => {
    const t = tutores.find((x) => x.id === id);
    $('tutorId').value = t.id;
    $('tutorNome').value = t.nome;
    $('tutorCpf').value = '';
    $('tutorCpf').placeholder = 'Deixe em branco para manter o atual';
    $('tutorTelefone').value = t.telefone || '';
    $('tutorEmail').value = t.email || '';
    $('tituloFormTutor').textContent = 'Editar tutor';
    $('formTutor').scrollIntoView({ behavior: 'smooth' });
  };

  function limparFormTutor() {
    $('formTutor').reset();
    $('tutorId').value = '';
    $('tutorCpf').placeholder = '000.000.000-00';
    $('tituloFormTutor').textContent = 'Novo tutor';
    mostrarErro('msgTutor', '');
  }
  $('btnCancelarTutor').addEventListener('click', limparFormTutor);

  // Salvar: se tem id => PUT (editar); se não => POST (cadastrar)
  $('formTutor').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = $('tutorId').value;
    const corpo = {
      nome: $('tutorNome').value,
      cpf: $('tutorCpf').value,
      telefone: $('tutorTelefone').value,
      email: $('tutorEmail').value,
    };
    try {
      await api(id ? '/tutores/' + id : '/tutores', {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify(corpo),
      });
      limparFormTutor();
      carregarTutores($('busca').value);
    } catch (erro) {
      mostrarErro('msgTutor', erro.message);
    }
  });

  carregarTutores();
}

// =====================================================
// PETS (listagem + cadastro com tutor obrigatório)
// =====================================================
if (pagina === 'pets') {
  async function carregarPets() {
    const pets = await api('/pets');
    $('tabelaPets').innerHTML = pets.map((p) => `
      <tr>
        <td>${esc(p.nome)}</td>
        <td>${esc(p.especie)}</td>
        <td>${esc(p.raca)}</td>
        <td>${formatarData(p.data_nascimento)}</td>
        <td>${esc(p.tutor)}</td>
      </tr>`).join('');
  }

  // Preenche o <select> com os tutores existentes
  async function carregarSelectTutores() {
    const tutores = await api('/tutores');
    $('petTutor').innerHTML = '<option value="">Selecione o tutor...</option>' +
      tutores.map((t) => `<option value="${t.id}">${esc(t.nome)}</option>`).join('');
  }

  $('formPet').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('/pets', {
        method: 'POST',
        body: JSON.stringify({
          nome: $('petNome').value,
          especie: $('petEspecie').value,
          raca: $('petRaca').value,
          data_nascimento: $('petNascimento').value,
          tutor_id: $('petTutor').value, // tutor obrigatório
        }),
      });
      $('formPet').reset();
      mostrarErro('msgPet', '');
      carregarPets();
    } catch (erro) {
      mostrarErro('msgPet', erro.message);
    }
  });

  carregarPets();
  carregarSelectTutores();
}

// =====================================================
// AGENDAMENTOS (listagem ordenada + remarcar data + novo)
// =====================================================
if (pagina === 'agendamentos') {
  let agendamentos = [];

  async function carregarAgendamentos() {
    // A ordenação por data já vem pronta do backend (ORDER BY data_agendamento)
    agendamentos = await api('/agendamentos');
    $('tabelaAgendamentos').innerHTML = agendamentos.map((a) => `
      <tr>
        <td>${formatarDataHora(a.data_agendamento)}</td>
        <td>${esc(a.servico)}</td>
        <td>${esc(a.status)}</td>
        <td>${esc(a.pet)}</td>
        <td>${esc(a.especie)}</td>
        <td>${esc(a.tutor)}</td>
        <td>${esc(a.telefone)}</td>
        <td><button onclick="editarAgendamento(${a.id})">Alterar data</button></td>
      </tr>`).join('');
  }

  // Abre o formulário de edição (somente a data)
  window.editarAgendamento = (id) => {
    const a = agendamentos.find((x) => x.id === id);
    $('agendamentoId').value = a.id;
    $('novaData').value = a.data_agendamento; // formato 'AAAA-MM-DDTHH:MM' serve direto no input
    $('infoEditar').textContent = `${a.pet} (${a.tutor}) - ${a.servico}`;
    $('secaoEditar').hidden = false;
    $('secaoEditar').scrollIntoView({ behavior: 'smooth' });
  };

  $('btnCancelarEditar').addEventListener('click', () => {
    $('secaoEditar').hidden = true;
    mostrarErro('msgEditar', '');
  });

  $('formEditarData').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('/agendamentos/' + $('agendamentoId').value, {
        method: 'PUT',
        body: JSON.stringify({ data_agendamento: $('novaData').value }),
      });
      $('secaoEditar').hidden = true;
      carregarAgendamentos(); // recarrega: a lista é reordenada com a nova data
    } catch (erro) {
      mostrarErro('msgEditar', erro.message);
    }
  });

  // Novo agendamento
  async function carregarSelectPets() {
    const pets = await api('/pets');
    $('agPet').innerHTML = '<option value="">Selecione o pet...</option>' +
      pets.map((p) => `<option value="${p.id}">${esc(p.nome)} (${esc(p.tutor)})</option>`).join('');
  }

  $('formAgendamento').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('/agendamentos', {
        method: 'POST',
        body: JSON.stringify({
          pet_id: $('agPet').value,
          data_agendamento: $('agData').value,
          servico: $('agServico').value,
        }),
      });
      $('formAgendamento').reset();
      mostrarErro('msgAgendamento', '');
      carregarAgendamentos();
    } catch (erro) {
      mostrarErro('msgAgendamento', erro.message);
    }
  });

  carregarAgendamentos();
  carregarSelectPets();
}

