export const html = `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>📢 Announcement Sender | Ibtikar VMS</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .main-container {
            max-width: 900px;
            width: 100%;
        }
        
        .header {
            text-align: center;
            color: white;
            margin-bottom: 30px;
        }
        
        .header h1 {
            font-size: 2.5rem;
            font-weight: 700;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
        }
        
        .header p {
            font-size: 1.1rem;
            opacity: 0.95;
        }
        
        .container {
            background: white;
            padding: 40px;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        
        .tabs {
            display: flex;
            gap: 10px;
            margin-bottom: 30px;
            border-bottom: 2px solid #e0e0e0;
        }
        
        .tab {
            padding: 12px 24px;
            border: none;
            background: none;
            cursor: pointer;
            font-size: 16px;
            font-weight: 500;
            color: #666;
            border-bottom: 3px solid transparent;
            transition: all 0.3s;
        }
        
        .tab:hover {
            color: #667eea;
        }
        
        .tab.active {
            color: #667eea;
            border-bottom-color: #667eea;
        }
        
        .tab-content {
            display: none;
        }
        
        .tab-content.active {
            display: block;
            animation: fadeIn 0.3s;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .info {
            background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%);
            padding: 20px;
            border-left: 4px solid #667eea;
            border-radius: 8px;
            margin-bottom: 30px;
        }
        
        .info strong {
            color: #667eea;
            font-size: 16px;
        }
        
        .form-group {
            margin-bottom: 25px;
        }
        
        label {
            display: block;
            margin-bottom: 8px;
            font-weight: 600;
            color: #333;
            font-size: 14px;
        }
        
        input[type="text"],
        input[type="password"],
        textarea,
        select {
            width: 100%;
            padding: 12px 16px;
            border: 2px solid #e0e0e0;
            border-radius: 10px;
            font-size: 15px;
            font-family: inherit;
            transition: all 0.3s;
        }
        
        input:focus,
        textarea:focus,
        select:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        
        textarea {
            min-height: 150px;
            resize: vertical;
            font-family: inherit;
        }
        
        input[type="file"] {
            padding: 10px;
            border: 2px dashed #e0e0e0;
            border-radius: 10px;
            width: 100%;
            cursor: pointer;
            transition: all 0.3s;
        }
        
        input[type="file"]:hover {
            border-color: #667eea;
            background: #f8f9ff;
        }
        
        .attachment-type {
            display: flex;
            gap: 15px;
            flex-wrap: wrap;
        }
        
        .radio-label {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 10px 20px;
            border: 2px solid #e0e0e0;
            border-radius: 10px;
            cursor: pointer;
            transition: all 0.3s;
            font-weight: 500;
        }
        
        .radio-label:hover {
            border-color: #667eea;
            background: #f8f9ff;
        }
        
        .radio-label input[type="radio"]:checked + span {
            color: #667eea;
        }
        
        .radio-label input[type="radio"] {
            cursor: pointer;
        }
        
        .file-info {
            font-size: 13px;
            color: #888;
            margin-top: 8px;
            font-style: italic;
        }
        
        .btn-group {
            display: flex;
            gap: 15px;
            margin-top: 30px;
        }
        
        button {
            flex: 1;
            padding: 15px 30px;
            border: none;
            border-radius: 10px;
            cursor: pointer;
            font-size: 16px;
            font-weight: 600;
            transition: all 0.3s;
            font-family: inherit;
        }
        
        .btn-primary {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        
        .btn-primary:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 10px 25px rgba(102, 126, 234, 0.4);
        }
        
        .btn-secondary {
            background: #f0f0f0;
            color: #666;
        }
        
        .btn-secondary:hover {
            background: #e0e0e0;
        }
        
        button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }
        
        .result {
            margin-top: 30px;
            padding: 20px;
            border-radius: 10px;
            display: none;
            animation: slideIn 0.3s;
        }
        
        @keyframes slideIn {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .result.success {
            background: #d4edda;
            color: #155724;
            border: 2px solid #c3e6cb;
            display: block;
        }
        
        .result.error {
            background: #f8d7da;
            color: #721c24;
            border: 2px solid #f5c6cb;
            display: block;
        }
        
        .result h3 {
            margin-bottom: 15px;
            font-size: 18px;
        }
        
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-top: 15px;
        }
        
        .stat-card {
            background: rgba(255,255,255,0.5);
            padding: 15px;
            border-radius: 8px;
        }
        
        .stat-card .label {
            font-size: 13px;
            opacity: 0.8;
            margin-bottom: 5px;
        }
        
        .stat-card .value {
            font-size: 24px;
            font-weight: 700;
        }
        
        .preview {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 10px;
            margin-top: 20px;
            border: 2px solid #e0e0e0;
        }
        
        .preview h3 {
            margin-bottom: 15px;
            color: #333;
        }
        
        .preview-content {
            background: white;
            padding: 15px;
            border-radius: 8px;
            min-height: 100px;
            white-space: pre-wrap;
            font-family: 'Courier New', monospace;
            font-size: 14px;
        }
        
        .character-count {
            text-align: right;
            font-size: 13px;
            color: #888;
            margin-top: 5px;
        }
        
        .history-item {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 10px;
            margin-bottom: 15px;
            border-left: 4px solid #667eea;
        }
        
        .history-item .time {
            font-size: 12px;
            color: #888;
            margin-bottom: 8px;
        }
        
        .history-item .message {
            color: #333;
            margin-bottom: 8px;
        }
        
        .history-item .stats-inline {
            font-size: 13px;
            color: #666;
        }
        
        .empty-state {
            text-align: center;
            padding: 40px;
            color: #999;
        }
        
        .empty-state svg {
            width: 80px;
            height: 80px;
            margin-bottom: 20px;
            opacity: 0.3;
        }
        
        @media (max-width: 768px) {
            body {
                padding: 10px;
            }
            
            .container {
                padding: 20px;
            }
            
            .header h1 {
                font-size: 1.8rem;
            }
            
            .tabs {
                overflow-x: auto;
            }
            
            .btn-group {
                flex-direction: column;
            }
        }
    </style>
</head>
<body>
    <div class="main-container">
        <div class="header">
            <h1>📢 Announcement Sender</h1>
            <p>Send announcements to all registered members</p>
        </div>
        
        <div class="container">
            <div class="tabs">
                <button class="tab active" data-tab="send">📤 Send</button>
                <button class="tab" data-tab="preview">👁️ Preview</button>
                <button class="tab" data-tab="history">📋 History</button>
            </div>

            <!-- Send Tab -->
            <div class="tab-content active" id="send-tab">
                <div class="info">
                    <strong>ℹ️ How it works:</strong> This tool sends announcements to all members in the Google Members Sheet who have registered their Telegram IDs. Messages are sent asynchronously to ensure delivery even if some fail.
                </div>

                <form id="announcementForm">
                    <div class="form-group">
                        <label for="apiUrl">🌐 API URL</label>
                        <input type="text" id="apiUrl" value="" required>
                    </div>

                    <div class="form-group">
                        <label for="apiKey">🔑 API Key</label>
                        <input type="password" id="apiKey" placeholder="Enter your API key" required>
                    </div>

                    <div class="form-group">
                        <label for="message">✉️ Message / Caption</label>
                        <textarea id="message" placeholder="Enter your announcement message..." required></textarea>
                        <div class="character-count">
                            <span id="charCount">0</span> characters
                        </div>
                    </div>

                    <div class="form-group">
                        <label for="parseMode">📝 Parse Mode</label>
                        <select id="parseMode">
                            <option value="">None (Plain Text)</option>
                            <option value="MarkdownV2">MarkdownV2</option>
                            <option value="HTML">HTML</option>
                            <option value="Markdown">Markdown</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label>📎 Attachment Type</label>
                        <div class="attachment-type">
                            <label class="radio-label">
                                <input type="radio" name="attachmentType" value="none" checked>
                                <span>📄 Text Only</span>
                            </label>
                            <label class="radio-label">
                                <input type="radio" name="attachmentType" value="photo">
                                <span>🖼️ Photo</span>
                            </label>
                            <label class="radio-label">
                                <input type="radio" name="attachmentType" value="document">
                                <span>📁 Document</span>
                            </label>
                        </div>
                    </div>

                    <div class="form-group" id="photoGroup" style="display: none;">
                        <label for="photo">📷 Select Photo</label>
                        <input type="file" id="photo" accept="image/*">
                        <div class="file-info">Supported: JPEG, PNG, GIF, etc. Max size: 10 MB</div>
                    </div>

                    <div class="form-group" id="documentGroup" style="display: none;">
                        <label for="document">📄 Select Document</label>
                        <input type="file" id="document">
                        <div class="file-info">Supported: PDF, DOC, DOCX, ZIP, TXT, etc. Max size: 50 MB</div>
                    </div>

                    <div class="btn-group">
                        <button type="button" class="btn-secondary" onclick="document.getElementById('announcementForm').reset(); document.getElementById('result').style.display='none';">
                            🔄 Reset
                        </button>
                        <button type="submit" class="btn-primary" id="submitBtn">
                            📤 Send Announcement
                        </button>
                    </div>
                </form>

                <div id="result" class="result"></div>
            </div>

            <!-- Preview Tab -->
            <div class="tab-content" id="preview-tab">
                <div class="info">
                    <strong>👁️ Message Preview:</strong> See how your message will appear before sending.
                </div>
                
                <div class="preview">
                    <h3>Message Content</h3>
                    <div class="preview-content" id="previewContent">
                        Your message preview will appear here...
                    </div>
                </div>
                
                <div class="preview" id="filePreview" style="display: none;">
                    <h3>Attachment Preview</h3>
                    <div id="filePreviewContent"></div>
                </div>
            </div>

            <!-- History Tab -->
            <div class="tab-content" id="history-tab">
                <div class="info">
                    <strong>📋 Sending History:</strong> View your recent announcements sent during this session.
                </div>
                
                <div id="historyList">
                    <div class="empty-state">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p>No announcements sent yet</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        // Auto-fill API URL based on current location
        (function() {
            const apiUrlInput = document.getElementById('apiUrl');
            const currentUrl = window.location.origin;
            apiUrlInput.value = currentUrl + '/api/announcement';
        })();

        // Tab switching
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                
                tab.classList.add('active');
                document.getElementById(tabName + '-tab').classList.add('active');
            });
        });

        // Character counter
        const messageInput = document.getElementById('message');
        const charCount = document.getElementById('charCount');
        const previewContent = document.getElementById('previewContent');
        
        messageInput.addEventListener('input', () => {
            const count = messageInput.value.length;
            charCount.textContent = count;
            previewContent.textContent = messageInput.value || 'Your message preview will appear here...';
        });

        // Attachment type handling
        const attachmentTypeRadios = document.querySelectorAll('input[name="attachmentType"]');
        const photoGroup = document.getElementById('photoGroup');
        const documentGroup = document.getElementById('documentGroup');
        const filePreview = document.getElementById('filePreview');
        const filePreviewContent = document.getElementById('filePreviewContent');

        attachmentTypeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                photoGroup.style.display = e.target.value === 'photo' ? 'block' : 'none';
                documentGroup.style.display = e.target.value === 'document' ? 'block' : 'none';
                filePreview.style.display = 'none';
                
                if (e.target.value !== 'photo') document.getElementById('photo').value = '';
                if (e.target.value !== 'document') document.getElementById('document').value = '';
            });
        });

        // File preview
        document.getElementById('photo').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    filePreviewContent.innerHTML = \`<img src="\${e.target.result}" style="max-width: 100%; border-radius: 8px;">\`;
                    filePreview.style.display = 'block';
                };
                reader.readAsDataURL(file);
            }
        });

        document.getElementById('document').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                filePreviewContent.innerHTML = \`
                    <div style="padding: 20px; background: white; border-radius: 8px;">
                        <strong>📄 \${file.name}</strong><br>
                        <span style="color: #888; font-size: 14px;">Size: \${(file.size / 1024).toFixed(2)} KB</span>
                    </div>
                \`;
                filePreview.style.display = 'block';
            }
        });

        // History management
        let history = JSON.parse(localStorage.getItem('announcementHistory') || '[]');
        
        function updateHistory() {
            const historyList = document.getElementById('historyList');
            
            if (history.length === 0) {
                historyList.innerHTML = \`
                    <div class="empty-state">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p>No announcements sent yet</p>
                    </div>
                \`;
            } else {
                historyList.innerHTML = history.map(item => \`
                    <div class="history-item">
                        <div class="time">⏰ \${item.time}</div>
                        <div class="message">\${item.message.substring(0, 100)}\${item.message.length > 100 ? '...' : ''}</div>
                        <div class="stats-inline">
                            👥 \${item.members_notified} members notified | 
                            📎 \${item.attachment_type}
                        </div>
                    </div>
                \`).join('');
            }
        }
        
        updateHistory();

        // Form submission
        const form = document.getElementById('announcementForm');
        const resultDiv = document.getElementById('result');
        const submitBtn = document.getElementById('submitBtn');

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const apiUrl = document.getElementById('apiUrl').value;
            const apiKey = document.getElementById('apiKey').value;
            const message = document.getElementById('message').value;
            const parseMode = document.getElementById('parseMode').value;
            const attachmentType = document.querySelector('input[name="attachmentType"]:checked').value;
            
            resultDiv.style.display = 'none';
            submitBtn.disabled = true;
            submitBtn.innerHTML = '⏳ Sending...';

            try {
                let response;

                if (attachmentType === 'none') {
                    response = await fetch(apiUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-API-Key': apiKey
                        },
                        body: JSON.stringify({
                            message: message,
                            parse_mode: parseMode || undefined
                        })
                    });
                } else {
                    const formData = new FormData();
                    formData.append('message', message);
                    if (parseMode) formData.append('parse_mode', parseMode);

                    if (attachmentType === 'photo') {
                        const photoFile = document.getElementById('photo').files[0];
                        if (!photoFile) throw new Error('Please select a photo file');
                        formData.append('photo', photoFile);
                    } else if (attachmentType === 'document') {
                        const documentFile = document.getElementById('document').files[0];
                        if (!documentFile) throw new Error('Please select a document file');
                        formData.append('document', documentFile);
                    }

                    response = await fetch(apiUrl, {
                        method: 'POST',
                        headers: { 'X-API-Key': apiKey },
                        body: formData
                    });
                }

                const data = await response.json();

                if (response.ok) {
                    resultDiv.className = 'result success';
                    resultDiv.innerHTML = \`
                        <h3>✅ Success!</h3>
                        <p>\${data.message}</p>
                        <div class="stats">
                            <div class="stat-card">
                                <div class="label">Total Members</div>
                                <div class="value">\${data.total_members}</div>
                            </div>
                            <div class="stat-card">
                                <div class="label">With Telegram</div>
                                <div class="value">\${data.members_with_telegram}</div>
                            </div>
                            <div class="stat-card">
                                <div class="label">Notified</div>
                                <div class="value">\${data.members_notified}</div>
                            </div>
                            <div class="stat-card">
                                <div class="label">Attachment</div>
                                <div class="value">\${data.attachment_type}</div>
                            </div>
                        </div>
                    \`;
                    
                    // Add to history
                    history.unshift({
                        time: new Date().toLocaleString(),
                        message: message,
                        members_notified: data.members_notified,
                        attachment_type: data.attachment_type
                    });
                    history = history.slice(0, 10); // Keep only last 10
                    localStorage.setItem('announcementHistory', JSON.stringify(history));
                    updateHistory();
                } else {
                    resultDiv.className = 'result error';
                    resultDiv.innerHTML = \`
                        <h3>❌ Error!</h3>
                        <p>\${data.error || 'Unknown error occurred'}</p>
                        \${data.details ? \`<p><small>Details: \${data.details}</small></p>\` : ''}
                    \`;
                }
            } catch (error) {
                resultDiv.className = 'result error';
                resultDiv.innerHTML = \`
                    <h3>❌ Error!</h3>
                    <p>\${error.message}</p>
                \`;
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '📤 Send Announcement';
            }
        });
    </script>
</body>
</html>`;
