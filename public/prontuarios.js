// Variáveis globais para controlar a edição e o popup
let currentEntryId = null; // Qual popup está aberto
let editId = null; // Qual prontuário estamos editando

// Chave do localStorage
const STORAGE_KEY = 'mindflow_prontuarios';

// Formato de data (ex: 30/10/2025, 16:04)
const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short'
});

// 1. ESPERA A PÁGINA CARREGAR PARA EXECUTAR TUDO
document.addEventListener('DOMContentLoaded', () => {

  // --- PEGANDO REFERÊNCIAS ---
  // Inputs do formulário
  const nomeInput = document.getElementById('paciente-nome');
  const diagnosticoInput = document.getElementById('paciente-diagnostico');
  const prontuarioInput = document.getElementById('paciente-prontuario');
  
  // Botão de Salvar
  const btnSalvar = document.getElementById('btn-salvar-prontuario');
  
  // Container dos cards
  const entriesContainer = document.getElementById('entries-container');
  
  // Elementos do Popup
  const popup = document.getElementById('popup');
  const popupTitle = document.getElementById('popup-title');
  const popupDate = document.getElementById('popup-date');
  const popupDiagnostico = document.getElementById('popup-diagnostico');
  const popupText = document.getElementById('popup-text');
  
  // Botões do Popup
  const btnPopupFechar = document.getElementById('btn-popup-fechar');
  const btnPopupEditar = document.getElementById('btn-popup-editar');
  const btnPopupExcluir = document.getElementById('btn-popup-excluir');

  
  // --- ADICIONANDO OS EVENTOS (CLICKS) ---
  if(btnSalvar) {
    btnSalvar.addEventListener('click', salvarProntuario);
  }
  if(btnPopupFechar) {
    btnPopupFechar.addEventListener('click', closePopup);
  }
  if(btnPopupEditar) {
    btnPopupEditar.addEventListener('click', editProntuario);
  }
  if(btnPopupExcluir) {
    btnPopupExcluir.addEventListener('click', deleteProntuario);
  }
  
  // Carrega os prontuários iniciais
  carregarProntuarios();

  
  // --- DEFINIÇÃO DAS FUNÇÕES ---

  // 2. Função para carregar e exibir os cards de pacientes
  function carregarProntuarios() {
    const prontuarios = getProntuarios();
    
    entriesContainer.innerHTML = ''; // Limpa a lista
    
    if (prontuarios.length === 0) {
      entriesContainer.innerHTML = '<p>Nenhum paciente salvo localmente.</p>';
      return;
    }
    
    prontuarios.sort((a, b) => new Date(b.data) - new Date(a.data));

    prontuarios.forEach(entry => {
      const card = document.createElement('div');
      card.className = 'entry-card';
      
      // *** CORREÇÃO APLICADA AQUI ***
      // Adiciona o clique da forma correta
      card.addEventListener('click', () => {
        openPopup(entry.id);
      });
      
      card.innerHTML = `
        <h3>${escapeHTML(entry.nome)}</h3>
        <p><strong>Diagnóstico:</strong> ${escapeHTML(entry.diagnostico) || 'Não informado'}</p>
        <small>Última att: ${dateFormatter.format(new Date(entry.data))}</small>
      `;
      entriesContainer.appendChild(card);
    });
  }

  // 3. Função para salvar (ou atualizar) um prontuário
  function salvarProntuario() {
    const nome = nomeInput.value.trim();
    const diagnostico = diagnosticoInput.value.trim();
    const prontuario = prontuarioInput.value.trim();

    if (!nome) {
      alert('O nome do paciente é obrigatório.');
      return;
    }

    let prontuarios = getProntuarios();
    
    if (editId) {
      // Modo de Edição
      const index = prontuarios.findIndex(e => e.id === editId);
      if (index > -1) {
        prontuarios[index].nome = nome;
        prontuarios[index].diagnostico = diagnostico;
        prontuarios[index].prontuario = prontuario;
        prontuarios[index].data = new Date().toISOString();
      }
    } else {
      // Modo de Criação
      const newEntry = {
        id: Date.now(),
        nome: nome,
        diagnostico: diagnostico,
        prontuario: prontuario,
        data: new Date().toISOString()
      };
      prontuarios.push(newEntry);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(prontuarios));
    resetForm();
    carregarProntuarios();
  }

  // 4. Abre o popup com os detalhes
  function openPopup(id) {
    const prontuarios = getProntuarios();
    const entry = prontuarios.find(e => e.id === id);
    if (!entry) return;

    currentEntryId = id; // Define qual ID está ativo

    popupTitle.textContent = escapeHTML(entry.nome);
    popupDate.textContent = `Última atualização: ${dateFormatter.format(new Date(entry.data))}`;
    popupDiagnostico.textContent = escapeHTML(entry.diagnostico) || 'Não informado';
    popupText.textContent = escapeHTML(entry.prontuario) || 'Nenhuma anotação.';
    
    popup.classList.remove('hidden');
  }

  // 5. Fecha o popup
  function closePopup() {
    popup.classList.add('hidden');
    currentEntryId = null;
  }

  // 6. Prepara o formulário para edição
  function editProntuario() {
    if (!currentEntryId) return;
    
    const prontuarios = getProntuarios();
    const entry = prontuarios.find(e => e.id === currentEntryId);
    if (!entry) return;

    editId = currentEntryId;

    nomeInput.value = entry.nome;
    diagnosticoInput.value = entry.diagnostico;
    prontuarioInput.value = entry.prontuario;
    
    closePopup();
    window.scrollTo(0, 0);
    nomeInput.focus();
  }

  // 7. Exclui um prontuário
  function deleteProntuario() {
    if (!currentEntryId) return;

    const deveExcluir = confirm('Tem certeza que deseja excluir este prontuário? Esta ação não pode ser desfeita.');
    
    if (!deveExcluir) {
      return;
    }

    let prontuarios = getProntuarios();
    prontuarios = prontuarios.filter(e => e.id !== currentEntryId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prontuarios));
    
    carregarProntuarios();
    closePopup();
  }

  // --- Funções Auxiliares ---

  function resetForm() {
    nomeInput.value = '';
    diagnosticoInput.value = '';
    prontuarioInput.value = '';
    editId = null;
  }

  function getProntuarios() {
    const data = localStorage.getItem(STORAGE_KEY);
    try {
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error("Erro ao ler prontuários do localStorage:", e);
      return [];
    }
  }

  function escapeHTML(str) {
      if (str === null || str === undefined) return '';
      return str.toString()
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
  }

}); // Fim do DOMContentLoaded