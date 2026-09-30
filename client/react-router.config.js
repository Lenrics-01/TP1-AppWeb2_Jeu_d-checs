// React Router en mode framework.
// ssr: true -> chaque page est d'abord rendue sur le serveur du client (Node),
// avec les données de ses loaders, puis « hydratée » dans le navigateur.
export default {
  appDirectory: 'app',
  ssr: true,
};
