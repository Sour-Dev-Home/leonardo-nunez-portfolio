import { RouterProvider, useRouter } from "./router/Router";
import { matchProjectSlug } from "./router/matchProjectSlug";
import { Home } from "./pages/Home";
import { ProjectDetail } from "./pages/ProjectDetail";

function AppRoutes() {
  const { path } = useRouter();
  const slug = matchProjectSlug(path);
  if (slug) {
    return <ProjectDetail slug={slug} />;
  }
  return <Home />;
}

function App() {
  return (
    <RouterProvider>
      <AppRoutes />
    </RouterProvider>
  );
}

export default App;
