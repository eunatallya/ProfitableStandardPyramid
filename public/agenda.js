document.addEventListener('DOMContentLoaded', () => {

    // --- Pega os elementos do HTML ---
    const agendaDateInput = document.getElementById('agenda-date');
    const agendaInputText = document.getElementById('agenda-input-text');
    const saveBtn = document.getElementById('btn-salvar-entrada');
    const logContainer = document.getElementById('agenda-log-container');

    // Chave principal para salvar no localStorage
    const STORAGE_KEY_PREFIX = 'mindflow_agenda_';
    
    // Variável de estado para edição
    let currentEditId = null;

    // Formato de data/hora (ex: 30/10/2025, 16:30)
    const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short'
    });

    // --- Funções ---

    // 1. Pega os registros do localStorage para um dia específico
    function getEntriesForDay(dateKey) {
        const storageKey = STORAGE_KEY_PREFIX + dateKey;
        const data = localStorage.getItem(storageKey);
        try {
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error("Erro ao ler dados da agenda:", e);
            return [];
        }
    }

    // 2. Carrega e exibe os registros do dia selecionado
    function loadDayEntries() {
        const selectedDate = agendaDateInput.value;
        if (!selectedDate) {
            logContainer.innerHTML = '<li class="empty-message">Selecione um dia.</li>';
            return;
        }

        const entries = getEntriesForDay(selectedDate);
        logContainer.innerHTML = ''; // Limpa o log

        if (entries.length === 0) {
            logContainer.innerHTML = '<li class="empty-message">Nenhuma anotação para este dia.</li>';
            return;
        }
        
        entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        entries.forEach(entry => {
            const li = document.createElement('li');
            li.className = 'log-item';
            
            const entryDate = new Date(entry.timestamp);
            
            // Cria o conteúdo do log
            li.innerHTML = `
                <span class="log-date">Registrado em: ${dateTimeFormatter.format(entryDate)}</span>
                <p class="log-content">${escapeHTML(entry.text)}</p>
                <div class="log-actions">
                    <button class="btn-edit" data-id="${entry.id}">Editar</button>
                    <button class="btn-delete" data-id="${entry.id}">Excluir</button>
                </div>
            `;
            
            logContainer.appendChild(li);
        });

        // *** IMPORTANTE: Adiciona os cliques DEPOIS de criar os botões ***
        addLogButtonListeners();
    }

    // 3. Adiciona os listeners aos botões de Editar/Excluir
    function addLogButtonListeners() {
        logContainer.querySelectorAll('.btn-edit').forEach(button => {
            button.addEventListener('click', (e) => {
                const id = Number(e.target.dataset.id);
                editEntry(id);
            });
        });
        
        logContainer.querySelectorAll('.btn-delete').forEach(button => {
            button.addEventListener('click', (e) => {
                const id = Number(e.target.dataset.id);
                deleteEntry(id);
            });
        });
    }

    // 4. Salva (Cria OU Atualiza) uma entrada
    function saveEntry() {
        const selectedDate = agendaDateInput.value;
        const text = agendaInputText.value.trim();

        if (!selectedDate) {
            alert('Por favor, selecione uma data primeiro.');
            return;
        }
        if (text === '') {
            alert('Por favor, digite uma anotação.');
            return;
        }

        let entries = getEntriesForDay(selectedDate);
        const storageKey = STORAGE_KEY_PREFIX + selectedDate;
        
        if (currentEditId) {
            // --- MODO DE EDIÇÃO ---
            const index = entries.findIndex(e => e.id === currentEditId);
            if (index > -1) {
                entries[index].text = text;
                entries[index].timestamp = new Date().toISOString(); // Atualiza data
            }
            // Reseta o estado
            currentEditId = null;
            saveBtn.textContent = 'Salvar Entrada';
            
        } else {
            // --- MODO DE CRIAÇÃO ---
            const newEntry = {
                id: Date.now(),
                timestamp: new Date().toISOString(),
                text: text
            };
            entries.push(newEntry);
        }
        
        // Salva a lista atualizada de volta no localStorage
        localStorage.setItem(storageKey, JSON.stringify(entries));

        // Limpa a caixa de texto e recarrega o log
        agendaInputText.value = '';
        loadDayEntries();
    }
    
    // 5. Prepara o formulário para editar uma entrada
    function editEntry(id) {
        const selectedDate = agendaDateInput.value;
        const entries = getEntriesForDay(selectedDate);
        
        const entryToEdit = entries.find(e => e.id === id);
        if (!entryToEdit) return;

        // Carrega o texto na caixa de input
        agendaInputText.value = entryToEdit.text;
        
        // Define o estado de edição
        currentEditId = id;
        
        // Muda o botão de salvar
        saveBtn.textContent = 'Atualizar Anotação';
        
        // Foca na caixa de texto
        agendaInputText.focus();
        
        // Rola a tela para o topo
        document.querySelector('.input-section').scrollIntoView({ behavior: 'smooth' });
    }
    
    // 6. Exclui uma entrada
    function deleteEntry(id) {
        if (!confirm('Tem certeza que deseja excluir esta anotação?')) {
            return;
        }
        
        const selectedDate = agendaDateInput.value;
        let entries = getEntriesForDay(selectedDate);
        
        // Filtra o array, removendo o item com o ID correspondente
        entries = entries.filter(e => e.id !== id);
        
        // Salva a lista filtrada de volta no localStorage
        const storageKey = STORAGE_KEY_PREFIX + selectedDate;
        localStorage.setItem(storageKey, JSON.stringify(entries));
        
        // Recarrega o log
        loadDayEntries();
    }


    // --- Inicialização ---
    agendaDateInput.value = new Date().toISOString().split('T_')[0];
    loadDayEntries(); 

    // --- Eventos (Cliques) ---
    agendaDateInput.addEventListener('change', () => {
        // Ao mudar de dia, cancela qualquer edição pendente
        currentEditId = null;
        saveBtn.textContent = 'Salvar Entrada';
        agendaInputText.value = '';
        
        loadDayEntries();
    });
    
    saveBtn.addEventListener('click', saveEntry); // Nome da função atualizado
    
    
    // --- Função Auxiliar ---
    function escapeHTML(str) {
        if (str === null || str === undefined) return '';
        return str.toString()
                  .replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;')
                  .replace(/"/g, '&quot;')
                  .replace(/'/g, '&#039;');
    }
});