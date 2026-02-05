import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bold, List, CheckSquare, Link as LinkIcon, Edit2, Eye, Heading, Sparkles, Loader2 } from 'lucide-react';

interface MarkdownEditorProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    onAiGenerate?: () => void;
    isGenerating?: boolean;
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({ 
    value, 
    onChange, 
    placeholder, 
    className,
    onAiGenerate,
    isGenerating
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    const insertText = (before: string, after: string = '') => {
        if (!textareaRef.current) return;
        
        const start = textareaRef.current.selectionStart;
        const end = textareaRef.current.selectionEnd;
        const text = textareaRef.current.value;
        const selected = text.substring(start, end);
        
        const newText = text.substring(0, start) + before + selected + after + text.substring(end);
        onChange(newText);
        
        // Reset focus and cursor
        setTimeout(() => {
            if (textareaRef.current) {
                textareaRef.current.focus();
                textareaRef.current.setSelectionRange(start + before.length, end + before.length);
            }
        }, 0);
    };

    const handleBold = () => insertText('**', '**');
    const handleList = () => insertText('- ');
    const handleChecklist = () => insertText('- [ ] ');
    const handleLink = () => insertText('[', '](url)');
    const handleHeading = () => insertText('### ');

    const toggleMode = () => setIsEditing(!isEditing);

    // If empty, default to editing mode so user sees placeholder
    const showEditor = isEditing || !value;

    return (
        <div className={`flex flex-col border border-gray-200 rounded-xl overflow-hidden bg-white ${className}`}>
            {/* Toolbar */}
            <div className="flex items-center justify-between p-2 bg-gray-50 border-b border-gray-200 gap-2 flex-wrap">
                <div className="flex items-center gap-1">
                    <button onClick={handleHeading} className="p-1.5 hover:bg-white hover:shadow-sm rounded text-gray-600 transition-all" title="Heading">
                        <Heading size={16} />
                    </button>
                    <button onClick={handleBold} className="p-1.5 hover:bg-white hover:shadow-sm rounded text-gray-600 transition-all" title="Bold">
                        <Bold size={16} />
                    </button>
                    <button onClick={handleList} className="p-1.5 hover:bg-white hover:shadow-sm rounded text-gray-600 transition-all" title="Bullet List">
                        <List size={16} />
                    </button>
                    <button onClick={handleChecklist} className="p-1.5 hover:bg-white hover:shadow-sm rounded text-gray-600 transition-all" title="Checklist">
                        <CheckSquare size={16} />
                    </button>
                    <button onClick={handleLink} className="p-1.5 hover:bg-white hover:shadow-sm rounded text-gray-600 transition-all" title="Link">
                        <LinkIcon size={16} />
                    </button>
                </div>
                
                <div className="flex items-center gap-2">
                    {onAiGenerate && (
                        <button 
                            onClick={onAiGenerate}
                            disabled={isGenerating}
                            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-indigo-600 bg-indigo-100 hover:bg-indigo-200 rounded-md transition-colors disabled:opacity-50"
                            title="Auto-generate Must See/Do/Try lists"
                        >
                            {isGenerating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                            {isGenerating ? 'Thinking...' : 'AI Enhance'}
                        </button>
                    )}

                    {value && (
                        <button 
                            onClick={toggleMode} 
                            className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 rounded-full transition-colors"
                        >
                            {isEditing ? <><Eye size={12} /> Preview</> : <><Edit2 size={12} /> Edit</>}
                        </button>
                    )}
                </div>
            </div>

            <div className="relative min-h-[200px] flex-1">
                {showEditor ? (
                    <textarea
                        ref={textareaRef}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        className="w-full h-full p-4 resize-none outline-none text-sm text-gray-800 font-mono leading-relaxed bg-white"
                        placeholder={placeholder || "Add notes... \n\nTip: Use 'AI Enhance' to get recommendations!"}
                        style={{ minHeight: '200px' }}
                    />
                ) : (
                    <div 
                        className="w-full h-full p-4 markdown-body text-sm text-gray-800 overflow-y-auto cursor-text" 
                        onClick={() => setIsEditing(true)}
                        style={{ minHeight: '200px' }}
                    >
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {value}
                        </ReactMarkdown>
                    </div>
                )}
            </div>
        </div>
    );
};