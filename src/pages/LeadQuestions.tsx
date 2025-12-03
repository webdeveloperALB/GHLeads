import React, { useState, useEffect } from 'react';
import { supabase, type LeadQuestion } from '../lib/supabase';
import { Plus, Trash2, GripVertical, Save } from 'lucide-react';
import toast from 'react-hot-toast';

const LeadQuestions = () => {
  const [questions, setQuestions] = useState<LeadQuestion[]>([]);
  const [newQuestion, setNewQuestion] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    try {
      const { data, error } = await supabase
        .from('lead_questions')
        .select('*')
        .order('order');

      if (error) throw error;
      setQuestions(data || []);
    } catch (error) {
      console.error('Error fetching questions:', error);
      toast.error('Failed to fetch questions');
    } finally {
      setLoading(false);
    }
  };

  const handleAddQuestion = async () => {
    if (!newQuestion.trim()) return;

    try {
      const { error } = await supabase
        .from('lead_questions')
        .insert({
          question: newQuestion.trim(),
          order: questions.length,
          is_active: true
        });

      if (error) throw error;

      toast.success('Question added successfully');
      setNewQuestion('');
      fetchQuestions();
    } catch (error) {
      console.error('Error adding question:', error);
      toast.error('Failed to add question');
    }
  };

  const handleToggleActive = async (questionId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('lead_questions')
        .update({ is_active: !isActive })
        .eq('id', questionId);

      if (error) throw error;

      toast.success(`Question ${isActive ? 'disabled' : 'enabled'}`);
      fetchQuestions();
    } catch (error) {
      console.error('Error toggling question:', error);
      toast.error('Failed to update question');
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!window.confirm('Are you sure you want to delete this question? This will also delete all answers to this question.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('lead_questions')
        .delete()
        .eq('id', questionId);

      if (error) throw error;

      toast.success('Question deleted');
      fetchQuestions();
    } catch (error) {
      console.error('Error deleting question:', error);
      toast.error('Failed to delete question');
    }
  };

  const handleReorder = async (questions: LeadQuestion[]) => {
    setSaving(true);
    try {
      const updates = questions.map((question, index) => ({
        id: question.id,
        order: index
      }));

      const { error } = await supabase
        .from('lead_questions')
        .upsert(updates);

      if (error) throw error;

      toast.success('Questions reordered successfully');
      fetchQuestions();
    } catch (error) {
      console.error('Error reordering questions:', error);
      toast.error('Failed to reorder questions');
    } finally {
      setSaving(false);
    }
  };

  const moveQuestion = (fromIndex: number, toIndex: number) => {
    const updatedQuestions = [...questions];
    const [movedQuestion] = updatedQuestions.splice(fromIndex, 1);
    updatedQuestions.splice(toIndex, 0, movedQuestion);
    setQuestions(updatedQuestions);
    handleReorder(updatedQuestions);
  };

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Lead Questions</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Add New Question</h2>
          <div className="space-y-4">
            <textarea
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              placeholder="Enter question text..."
              className="w-full bg-gray-700 rounded-lg px-3 py-2 min-h-[100px]"
            />
            <button
              onClick={handleAddQuestion}
              disabled={!newQuestion.trim()}
              className="px-4 py-2 bg-green-600 rounded-lg flex items-center space-x-2 hover:bg-green-500 disabled:opacity-50"
            >
              <Plus size={16} />
              <span>Add Question</span>
            </button>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Existing Questions</h2>
          <div className="space-y-2">
            {questions.map((question, index) => (
              <div
                key={question.id}
                className="flex items-center space-x-3 bg-gray-700 rounded-lg px-4 py-2"
              >
                <button
                  className="cursor-move text-gray-400 hover:text-white"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    const target = e.currentTarget;
                    const parent = target.closest('div');
                    if (!parent) return;

                    const startY = e.pageY;
                    const startTop = parent.offsetTop;
                    const items = Array.from(parent.parentElement?.children || []);
                    const startIndex = items.indexOf(parent);

                    const handleMouseMove = (e: MouseEvent) => {
                      const currentY = e.pageY;
                      const diff = currentY - startY;
                      parent.style.transform = `translateY(${diff}px)`;
                      parent.style.zIndex = '10';

                      const currentIndex = items.findIndex(item => {
                        const rect = item.getBoundingClientRect();
                        return currentY >= rect.top && currentY <= rect.bottom;
                      });

                      if (currentIndex !== -1 && currentIndex !== startIndex) {
                        moveQuestion(startIndex, currentIndex);
                      }
                    };

                    const handleMouseUp = () => {
                      document.removeEventListener('mousemove', handleMouseMove);
                      document.removeEventListener('mouseup', handleMouseUp);
                      parent.style.transform = '';
                      parent.style.zIndex = '';
                    };

                    document.addEventListener('mousemove', handleMouseMove);
                    document.addEventListener('mouseup', handleMouseUp);
                  }}
                >
                  <GripVertical size={16} />
                </button>

                <span className={question.is_active ? 'text-white' : 'text-gray-400'}>
                  {question.question}
                </span>

                <div className="flex-1" />

                <button
                  onClick={() => handleToggleActive(question.id, question.is_active)}
                  className={`px-2 py-1 rounded text-sm ${
                    question.is_active
                      ? 'bg-green-600/20 text-green-400'
                      : 'bg-red-600/20 text-red-400'
                  }`}
                >
                  {question.is_active ? 'Active' : 'Inactive'}
                </button>

                <button
                  onClick={() => handleDeleteQuestion(question.id)}
                  className="text-red-500 hover:text-red-400 p-1"
                  title="Delete question"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}

            {questions.length === 0 && (
              <div className="text-center text-gray-400 py-4">
                No questions added yet
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeadQuestions;