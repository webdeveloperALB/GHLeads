import React, { useState, useEffect } from 'react';
import { supabase, type LeadQuestion, type LeadAnswer } from '../lib/supabase';
import { Save } from 'lucide-react';
import toast from 'react-hot-toast';

interface LeadQuestionsSectionProps {
  leadId: string;
}

const LeadQuestionsSection: React.FC<LeadQuestionsSectionProps> = ({ leadId }) => {
  const [questions, setQuestions] = useState<LeadQuestion[]>([]);
  const [answers, setAnswers] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchQuestionsAndAnswers();
  }, [leadId]);

  const fetchQuestionsAndAnswers = async () => {
    try {
      // Fetch questions
      const { data: questionsData, error: questionsError } = await supabase
        .from('lead_questions')
        .select('*')
        .eq('is_active', true)
        .order('order');

      if (questionsError) throw questionsError;
      setQuestions(questionsData || []);

      // Fetch answers for this lead
      const { data: answersData, error: answersError } = await supabase
        .from('lead_answers')
        .select('*')
        .eq('lead_id', leadId);

      if (answersError) throw answersError;

      // Convert answers array to object for easier access
      const answersObj = (answersData || []).reduce((acc, answer) => ({
        ...acc,
        [answer.question_id]: answer.answer
      }), {});

      setAnswers(answersObj);
    } catch (error) {
      console.error('Error fetching questions and answers:', error);
      toast.error('Failed to load questions');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const promises = Object.entries(answers).map(([questionId, answer]) => 
        supabase
          .from('lead_answers')
          .upsert({
            lead_id: leadId,
            question_id: questionId,
            answer
          })
      );

      await Promise.all(promises);

      // Add activity record
      await supabase.from('lead_activities').insert({
        lead_id: leadId,
        type: 'questions_updated',
        description: 'Lead questions updated'
      });

      toast.success('Answers saved successfully');
    } catch (error) {
      console.error('Error saving answers:', error);
      toast.error('Failed to save answers');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-gray-400">Loading questions...</div>;
  }

  if (questions.length === 0) {
    return <div className="text-sm text-gray-400">No questions available</div>;
  }

  return (
    <div className="space-y-4">
      {questions.map((question) => (
        <div key={question.id}>
          <label className="block text-sm text-gray-400 mb-1">
            {question.question}
          </label>
          <textarea
            value={answers[question.id] || ''}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            className="w-full bg-gray-700 rounded-lg px-3 py-2 min-h-[80px]"
            placeholder="Enter answer..."
          />
        </div>
      ))}

      <button
        onClick={handleSave}
        disabled={saving}
        className="px-4 py-2 bg-blue-600 rounded-lg flex items-center space-x-2 hover:bg-blue-500 disabled:opacity-50"
      >
        <Save size={16} />
        <span>{saving ? 'Saving...' : 'Save Answers'}</span>
      </button>
    </div>
  );
};

export default LeadQuestionsSection;