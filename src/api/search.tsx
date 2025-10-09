import API from './httpClient';

export const searchSuggestions = (query: string) =>
  API.get(`/search/suggestions/?q=${query}`);

export const searchResult = (query: string) =>
  API.get(`/search/results/?q=${query}`);
